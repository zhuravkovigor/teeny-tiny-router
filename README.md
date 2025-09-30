# teeny-tiny-router

A minimal, dependency-free client-side router for modern web applications with built-in caching, script execution, and SSR compatibility.

## Features

- **Ultra lightweight** - Single file, no dependencies
- **Automatic link interception** - Works with regular `<a>` tags
- **Route parameters** - Support for `:id` params and `*` wildcards
- **Page caching** - Automatic caching of fetched pages
- **Intelligent prefetch** - Automatic prefetching on hover with configurable delay
- **Script execution** - Runs scripts from dynamically loaded content
- **SSR friendly** - Works seamlessly with server-side rendered pages
- **Flexible rendering** - Custom or automatic content rendering
- **Modern ES modules** - Native module support

## Installation

### NPM

```bash
npm install teeny-tiny-router
```

### CDN

```html
<script type="module">
  import { MiniRouter } from "https://unpkg.com/teeny-tiny-router/dist/teeny-tiny-router.es.js";
</script>
```

## Quick Start

### Basic Setup

```html
<!DOCTYPE html>
<html>
  <head>
    <title>My App</title>
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/posts/123">Post 123</a>
    </nav>

    <div id="app"></div>

    <script type="module">
      import { MiniRouter } from "./src/index.js";

      const router = new MiniRouter();

      // Handle navigation events
      router.on("navigate", ({ title, body }) => {
        if (title) document.title = title;
        document.querySelector("#app").innerHTML = body;
      });

      // Define routes
      router.route("/", () => {
        console.log("Home page loaded");
      });

      router.route("/posts/:id", (params) => {
        console.log("Post ID:", params.id);
      });

      // Initialize current page
      router.navigate(location.pathname, { replace: true });
    </script>
  </body>
</html>
```

## API Reference

### Constructor Options

```javascript
const router = new MiniRouter({
  htmlExtension: true, // Add .html to URLs
  interceptAllLinks: true, // Auto-intercept internal links
  contentSelector: "#app", // CSS selector to extract content from fetched pages
  prefetchOnHover: true, // Enable automatic prefetch on hover
  prefetchDelay: 0, // Delay in ms before prefetch starts
});
```

#### Options

- **`htmlExtension`** (boolean, default: `true`) - Automatically adds `.html` extension to URLs that don't have one
- **`interceptAllLinks`** (boolean, default: `true`) - Automatically intercepts all internal links. Set to `false` to use opt-in mode with `data-link` attribute
- **`contentSelector`** (string, default: `'#app'`) - CSS selector used to extract content from fetched HTML pages. If element not found, falls back to `<body>` content
- **`prefetchOnHover`** (boolean, default: `true`) - Automatically prefetch pages when hovering over links
- **`prefetchDelay`** (number, default: `0`) - Delay in milliseconds before starting prefetch on hover. Set to 0 for instant prefetch, or a higher value (e.g., 100-300ms) to avoid prefetching during quick mouse movements

### Methods

#### `router.route(pattern, callback)`

Define a route handler.

```javascript
// Simple route
router.route("/about", () => {
  console.log("About page");
});

// Route with parameters
router.route("/users/:id", (params) => {
  console.log("User ID:", params.id);
});

// Wildcard route
router.route("/admin/*", (params) => {
  console.log("Admin path:", params["*"]);
});

// Override content from route
router.route("/custom", () => {
  return {
    title: "Custom Page",
    body: "<h1>Custom Content</h1>",
  };
});
```

#### `router.navigate(url, options)`

Programmatically navigate to a URL.

```javascript
// Navigate to a new page
router.navigate("/about");

// Replace current history entry
router.navigate("/about", { replace: true });
```

#### `router.on(event, callback)`

Listen to router events.

```javascript
// Navigation events
router.on("navigate", ({ url, title, body }) => {
  document.title = title;
  document.querySelector("#app").innerHTML = body;
});

// Route-specific events
router.on("route:/users/:id", ({ params, url, title, body }) => {
  console.log("User route matched:", params.id);
});

// Prefetch events
router.on("prefetch", ({ url, data }) => {
  console.log("Page prefetched:", url);
});

router.on("prefetch:error", ({ url, error }) => {
  console.log("Prefetch failed:", url, error);
});
```

#### `router.prefetch(url)`

Manually prefetch a page in the background.

```javascript
// Prefetch a single page
router.prefetch("/about");
```

#### `router.prefetchAll(urls)`

Prefetch multiple pages at once.

```javascript
// Prefetch multiple pages
router.prefetchAll(["/about", "/contact", "/services"]);
```

#### `router.clearCache(url?)`

Clear the page cache.

```javascript
// Clear specific page from cache
router.clearCache("/about");

// Clear entire cache
router.clearCache();
```

#### `router.getCacheInfo()`

Get cache statistics.

```javascript
const info = router.getCacheInfo();
console.log(`Cache size: ${info.size}`);
console.log(`Cached URLs:`, info.urls);
```

#### `router.setPrefetchOnHover(enabled)`

Enable or disable prefetch on hover.

```javascript
// Disable prefetch on hover
router.setPrefetchOnHover(false);

// Re-enable prefetch on hover
router.setPrefetchOnHover(true);
```

### Route Parameters

```javascript
// Named parameters
router.route("/users/:id/posts/:postId", (params) => {
  console.log(params.id); // user ID
  console.log(params.postId); // post ID
});

// Wildcard (catch-all)
router.route("/files/*", (params) => {
  console.log(params["*"]); // everything after /files/
});
```

### Content Override

Route handlers can return content to override the fetched page:

```javascript
// Return HTML string
router.route("/dynamic", () => {
  return "<h1>Dynamic Content</h1>";
});

// Return object with title and body
router.route("/custom", () => {
  return {
    title: "Custom Title",
    body: "<h1>Custom Body</h1>",
  };
});
```

## Prefetch Features

### Automatic Prefetch on Hover

By default, the router automatically prefetches pages when users hover over links, significantly improving navigation speed. Prefetch happens instantly (no delay) to maximize the chance of having content ready before the user clicks.

### Manual Prefetch

You can manually prefetch pages to warm up the cache:

```javascript
// Prefetch important pages on app startup
router.prefetchAll(["/about", "/contact", "/products"]);

// Prefetch based on user behavior
document.addEventListener("scroll", () => {
  router.prefetch("/next-section");
});
```

### Disable Prefetch for Specific Links

Use the `data-no-prefetch` attribute to prevent automatic prefetching:

```html
<!-- This link won't be prefetched on hover -->
<a href="/heavy-page" data-no-prefetch>Heavy Page</a>

<!-- External links are automatically excluded -->
<a href="https://external-site.com">External</a>

<!-- Download links are automatically excluded -->
<a href="/document.pdf" download>Download PDF</a>
```

### Prefetch Events

Monitor prefetch activity with events:

```javascript
router.on("prefetch", ({ url, data }) => {
  console.log(`✓ Prefetched: ${url}`);
});

router.on("prefetch:error", ({ url, error }) => {
  console.log(`✗ Prefetch failed: ${url}`);
});
```

### Cache Management

Monitor and manage the page cache:

```javascript
// Check cache status
const { size, urls } = router.getCacheInfo();
console.log(`${size} pages cached: ${urls.join(", ")}`);

// Clear cache when needed
if (size > 50) {
  router.clearCache(); // Clear all
}

// Or clear specific pages
router.clearCache("/old-page");
```

## SSR Integration

### With Go html/template

```go
// main.go
func aboutHandler(w http.ResponseWriter, r *http.Request) {
    tmpl := `
<!DOCTYPE html>
<html>
<head>
    <title>About Us</title>
</head>
<body>
    <div id="app">
        <h1>About Page</h1>
        <p>Server-rendered content</p>
        <script>
            console.log('Page-specific script executed');
        </script>
    </div>
</body>
</html>`
    w.Header().Set("Content-Type", "text/html")
    fmt.Fprint(w, tmpl)
}
```

### With Node.js/Express

```javascript
app.get("/about", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>About</title>
</head>
<body>
    <div id="app">
        <h1>About Page</h1>
        <script>console.log('About page loaded');</script>
    </div>
</body>
</html>
  `);
});
```

## Advanced Usage

### Script Execution

Scripts in loaded content are automatically executed:

```javascript
import { MiniRouter, executeScripts } from "./src/index.js";

router.on("navigate", ({ title, body }) => {
  if (title) document.title = title;
  const app = document.querySelector("#app");
  app.innerHTML = body;
  executeScripts(app); // Manually execute scripts if needed
});
```

### Custom Link Handling

```javascript
// Disable automatic link interception
const router = new MiniRouter({ interceptAllLinks: false });

// Use data-link attribute for specific links
<a href="/about" data-link>
  About
</a>;
```

## Browser Support

- Chrome 61+
- Firefox 60+
- Safari 10.1+
- Edge 16+

Requires ES2017+ support (async/await, modules).

## Examples

Check the `/examples` directory for:

- Basic SPA setup
- SSR integration examples
- Advanced routing patterns
- Custom content selectors

## Contributing

1. Fork the repository
2. Create your feature branch
3. Add tests if applicable
4. Submit a pull request

## License

MIT License - see LICENSE file for details.
