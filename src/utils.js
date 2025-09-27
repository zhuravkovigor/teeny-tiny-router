// src/utils.js
// Helper utilities for MiniRouter

function normalizePath(path) {
  if (!path) return "/";
  // strip query/hash
  let p = path.split(/[?#]/)[0];
  // remove trailing slash except root
  if (p.length > 1) p = p.replace(/\/+$/, "");
  // drop .html if present
  if (p !== "/") p = p.replace(/\.html$/i, "");
  // collapse trailing /index to parent path
  p = p.replace(/\/(index)$/i, "");
  // remove trailing slash again after collapsing index
  if (p.length > 1) p = p.replace(/\/+$/, "");
  // ensure leading slash
  if (!p.startsWith("/")) p = "/" + p;
  return p;
}

export function parsePath(pattern, urlPath) {
  const ptn = normalizePath(pattern);
  const url = normalizePath(urlPath);

  const ptnSeg = ptn.split("/").filter(Boolean);
  const urlSeg = url.split("/").filter(Boolean);

  // support wildcard at the end: /foo/*
  const hasWildcard = ptnSeg[ptnSeg.length - 1] === "*";
  if (!hasWildcard && ptnSeg.length !== urlSeg.length) return null;
  if (hasWildcard && urlSeg.length < ptnSeg.length - 1) return null;

  const params = {};
  for (let i = 0; i < ptnSeg.length; i++) {
    const a = ptnSeg[i];
    const b = urlSeg[i];

    if (a === "*") {
      params["*"] = decodeURIComponent(urlSeg.slice(i).join("/"));
      break;
    }

    if (a?.startsWith(":")) {
      const key = a.slice(1);
      if (!b) return null;
      params[key] = decodeURIComponent(b);
      continue;
    }

    if (a !== b) return null;
  }

  return params;
}

export function parseHTML(htmlString, contentSelector = "#app") {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");

  const title = doc.title || "";
  // Prefer content from specified selector if present; fallback to body
  const contentEl = doc.querySelector(contentSelector);
  const body = contentEl
    ? contentEl.innerHTML
    : doc.body
    ? doc.body.innerHTML
    : htmlString;

  return { title, body };
}

// Execute scripts found inside a container (inline and external), preserving order.
export async function executeScripts(root) {
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
