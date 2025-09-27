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
  constructor({ htmlExtension = true, interceptAllLinks = true } = {}) {
    this.cache = new Map();
    this.routes = new Map();
    this.events = {};
    this.htmlExtension = htmlExtension;
    this.interceptAllLinks = interceptAllLinks;

    this._initLinkHandler();
    this._initPopStateHandler();
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

  async fetchPage(url) {
    if (this.cache.has(url)) return this.cache.get(url);
    try {
      const res = await fetch(url, {
        headers: { "X-Requested-With": "mini-router" },
        credentials: "same-origin",
      });
      const text = await res.text();
      const data = parseHTML(text);
      this.cache.set(url, data);
      return data;
    } catch (err) {
      const fallback = {
        title: "Error",
        body: `<h1>Network Error</h1><pre>${String(err)}</pre>`,
      };
      this.cache.set(url, fallback);
      return fallback;
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
}

// Export executeScripts for manual use if needed
export { executeScripts };
