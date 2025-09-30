// src/index.js
import { parseHTML, parsePath } from "./utils.js";

// Execute scripts found inside a container (inline and external), preserving order.
async function executeScripts(root) {
  const container =
    typeof root === "string" ? document.querySelector(root) : root;
  if (!container) return;

  const scripts = Array.from(container.querySelectorAll("script"));
  for (const oldScript of scripts) {
    const newScript = document.createElement("script");
    // copy attributes
    for (const attr of Array.from(oldScript.attributes)) {
      newScript.setAttribute(attr.name, attr.value);
    }

    if (!oldScript.src) {
      newScript.textContent = oldScript.textContent || "";
      oldScript.parentNode.replaceChild(newScript, oldScript);
    } else {
      await new Promise((resolve) => {
        newScript.onload = resolve;
        newScript.onerror = resolve; // fail-soft to not block navigation
        oldScript.parentNode.replaceChild(newScript, oldScript);
      });
    }
  }
}

export class MiniRouter {
  constructor({
    htmlExtension = true,
    interceptAllLinks = true,
    contentSelector = "#app",
    prefetchOnHover = true,
    prefetchDelay = 0,
  } = {}) {
    this.cache = new Map();
    this.routes = new Map();
    this.events = {};
    this.htmlExtension = htmlExtension;
    this.interceptAllLinks = interceptAllLinks;
    this.contentSelector = contentSelector;
    this.prefetchOnHover = prefetchOnHover;
    this.prefetchDelay = prefetchDelay;
    this.prefetchTimeouts = new Map();

    this._initLinkHandler();
    this._initPopStateHandler();
    this._initPrefetchHandler();
  }

  _normalizeUrl(url) {
    // Убираем query/hash для сопоставления маршрутов
    let clean = url.split(/[?#]/)[0];
    if (this.htmlExtension && !clean.endsWith(".html") && clean !== "/") {
      clean += ".html";
    }
    return clean;
  }

  _initLinkHandler() {
    document.addEventListener("click", (e) => {
      if (e.defaultPrevented) return;
      // Primary button only and no modifiers
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;

      const link = e.target.closest("a[href], [data-link]");
      if (!link) return;

      // Respect opt-in if interceptAllLinks is false
      if (!this.interceptAllLinks && !link.hasAttribute("data-link")) return;

      const href = link.getAttribute("href");
      if (!href) return;

      // If it's <a>, ensure same-origin and allowed
      if (link.tagName === "A") {
        const target = (link.getAttribute("target") || "").toLowerCase();
        if (target === "_blank") return;
        if (link.hasAttribute("download")) return;
        const rel = (link.getAttribute("rel") || "").toLowerCase();
        if (rel.includes("external")) return;
        const u = new URL(href, location.origin);
        if (u.origin !== location.origin) return;
      }

      e.preventDefault();
      this.navigate(href);
    });
  }

  _initPopStateHandler() {
    window.addEventListener("popstate", () => {
      this.navigate(location.pathname + location.search + location.hash, {
        replace: true,
      });
    });
  }

  _initPrefetchHandler() {
    if (!this.prefetchOnHover) return;

    document.addEventListener(
      "mouseenter",
      (e) => {
        const link = e.target.closest("a[href], [data-link]");
        if (!link) return;

        const href = link.getAttribute("href");
        if (!href) return;

        // Same checks as in click handler
        if (link.tagName === "A") {
          const target = (link.getAttribute("target") || "").toLowerCase();
          if (target === "_blank") return;
          if (link.hasAttribute("download")) return;
          const rel = (link.getAttribute("rel") || "").toLowerCase();
          if (rel.includes("external")) return;
          try {
            const u = new URL(href, location.origin);
            if (u.origin !== location.origin) return;
          } catch {
            return;
          }
        }

        // Skip prefetch if disabled for this link
        if (link.hasAttribute("data-no-prefetch")) return;

        // Prefetch immediately or with delay
        if (this.prefetchDelay === 0) {
          this.prefetch(href);
        } else {
          const timeoutId = setTimeout(() => {
            this.prefetch(href);
          }, this.prefetchDelay);
          this.prefetchTimeouts.set(link, timeoutId);
        }
      },
      true
    );

    if (this.prefetchDelay > 0) {
      document.addEventListener(
        "mouseleave",
        (e) => {
          const link = e.target.closest("a[href], [data-link]");
          if (!link) return;

          const timeoutId = this.prefetchTimeouts.get(link);
          if (timeoutId) {
            clearTimeout(timeoutId);
            this.prefetchTimeouts.delete(link);
          }
        },
        true
      );
    }
  }

  on(event, callback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
  }

  emit(event, payload) {
    if (this.events[event]) {
      this.events[event].forEach((cb) => cb(payload));
    }
  }

  route(pattern, callback) {
    this.routes.set(pattern, callback);
  }

  async fetchPage(url, isPrefetch = false) {
    if (this.cache.has(url)) return this.cache.get(url);
    try {
      const headers = { "X-Requested-With": "mini-router" };
      if (isPrefetch) {
        headers["Purpose"] = "prefetch";
      }

      const res = await fetch(url, {
        headers,
        credentials: "same-origin",
      });
      const text = await res.text();
      const data = parseHTML(text, this.contentSelector);
      this.cache.set(url, data);

      if (isPrefetch) {
        this.emit("prefetch", { url, data });
      }

      return data;
    } catch (err) {
      // Don't cache errors for prefetch requests
      if (isPrefetch) {
        this.emit("prefetch:error", { url, error: err });
        throw err;
      }

      const fallback = {
        title: "Error",
        body: `<h1>Network Error</h1><pre>${String(err)}</pre>`,
      };
      this.cache.set(url, fallback);
      return fallback;
    }
  }

  /**
   * Prefetch a page in the background
   * @param {string} url - URL to prefetch
   * @returns {Promise<void>}
   */
  async prefetch(url) {
    // Skip if already cached
    if (this.cache.has(url)) return;

    try {
      await this.fetchPage(url, true);
    } catch (err) {
      // Silently fail prefetch requests
      console.debug(`Prefetch failed for ${url}:`, err);
    }
  }

  async navigate(rawUrl, { replace = false } = {}) {
    const url = rawUrl;
    const matchUrl = this._normalizeUrl(rawUrl);
    const data = await this.fetchPage(rawUrl);
    let finalData = { ...data };

    for (let [pattern, callback] of this.routes.entries()) {
      const params = parsePath(pattern, matchUrl);
      if (params) {
        const ctx = { url, ...finalData };

        // Simple callback invocation - assume single param (params)
        const result = await Promise.resolve(callback(params));

        // Allow handler to override content
        if (result != null) {
          if (typeof result === "string") {
            finalData.body = result;
          } else if (typeof result === "object") {
            finalData = { ...finalData, ...result };
          }
        }

        this.emit(`route:${pattern}`, { ...ctx, params });
      }
    }

    const payload = { url, ...finalData };
    // If user attached custom navigate handlers, let them render.
    // Otherwise, perform a minimal default render to #app and execute scripts.
    const hasCustomNavigate =
      Array.isArray(this.events["navigate"]) &&
      this.events["navigate"].length > 0;
    if (hasCustomNavigate) {
      this.emit("navigate", payload);
    } else {
      // Simple default render to #app
      if (payload.title) document.title = payload.title;
      const container = document.querySelector("#app");
      if (container && typeof payload.body === "string") {
        container.innerHTML = payload.body;
        executeScripts(container);
      }
    }

    const title = finalData.title || document.title || "";
    if (replace) {
      history.replaceState({}, title, rawUrl);
    } else {
      history.pushState({}, title, rawUrl);
    }
  }

  /**
   * Prefetch multiple pages at once
   * @param {string[]} urls - Array of URLs to prefetch
   * @returns {Promise<void>}
   */
  async prefetchAll(urls) {
    const promises = urls.map((url) => this.prefetch(url));
    await Promise.allSettled(promises);
  }

  /**
   * Clear the page cache
   * @param {string} [url] - Specific URL to clear, or clear all if not provided
   */
  clearCache(url) {
    if (url) {
      this.cache.delete(url);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   * @returns {object} Cache info
   */
  getCacheInfo() {
    return {
      size: this.cache.size,
      urls: Array.from(this.cache.keys()),
    };
  }

  /**
   * Enable or disable prefetch on hover
   * @param {boolean} enabled
   */
  setPrefetchOnHover(enabled) {
    this.prefetchOnHover = enabled;
    if (!enabled) {
      // Clear any pending prefetch timeouts
      for (const timeoutId of this.prefetchTimeouts.values()) {
        clearTimeout(timeoutId);
      }
      this.prefetchTimeouts.clear();
    }
  }
}

// Export executeScripts for manual use if needed
export { executeScripts };
