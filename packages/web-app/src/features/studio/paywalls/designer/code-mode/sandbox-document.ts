/**
 * The sandbox iframe document. Rendered via `<iframe sandbox="allow-scripts">`
 * (no `allow-same-origin` → opaque origin: no cookies, storage, or parent DOM;
 * CSP `connect-src 'none'` blocks network). The inline bootstrap freezes time,
 * randomness, `performance.now`, and `requestAnimationFrame` for deterministic
 * caching, then, per postMessage `render` request: evals the OSS sandbox
 * runtime IIFE (sets a global), runs the compiled component (CJS) via
 * `new Function` with a `require` shim that maps every author-importable module
 * specifier onto the sandbox global's `modules`, extracts the manifest, renders
 * every preview state to a §3 node tree via the real react-reconciler path
 * (async), and posts the result back.
 *
 * Untrusted code executes via `eval`/`new Function` (hence CSP `'unsafe-eval'`),
 * but the opaque origin + `connect-src 'none'` are the real isolation: it has
 * no cookies, no network, and cannot reach the parent DOM — it can only return
 * data the host re-validates.
 *
 * Determinism: the reconciler render mounts, flushes passive effects, and
 * settles one macrotask. Freezing `Date.now`/`Math.random`/`performance.now`
 * keeps hook-driven values stable; `requestAnimationFrame` is a deterministic
 * no-op that NEVER runs its callback (so animation loops can't push
 * nondeterministic state into the committed tree, and can't leak past settle).
 *
 * The bootstrap is authored without backticks or `${` so it embeds safely in
 * this template literal.
 */
const BOOTSTRAP = `
(function () {
  try { Date.now = function () { return 1700000000000; }; } catch (e) {}
  try { Math.random = function () { return 0.42; }; } catch (e) {}
  try {
    if (typeof performance !== "undefined") { performance.now = function () { return 0; }; }
  } catch (e) {}
  // A deterministic rAF: register an id but never invoke the callback, so no
  // animation frame runs during (or after) the render settle. cancel is a no-op.
  try {
    var rafId = 0;
    window.requestAnimationFrame = function () { return ++rafId; };
    window.cancelAnimationFrame = function () {};
  } catch (e) {}

  var sandbox = null;
  function ensureSandbox(code) {
    if (!sandbox) {
      (0, eval)(code);
      sandbox = window.__VOIDHASH_PAYWALLS_SANDBOX__;
    }
    return sandbox;
  }

  function toMessage(err) { return err && err.message ? String(err.message) : String(err); }

  function handle(msg) {
    var runtime = ensureSandbox(msg.sandboxCode);
    if (!runtime) { throw new Error("sandbox runtime failed to load"); }
    // Map every author-importable specifier onto the bundled global's modules
    // (react, react/jsx-runtime, @voidhash/paywalls, its jsx runtimes, …).
    var requireShim = function (specifier) {
      var mod = runtime.modules[specifier];
      if (mod === undefined) { throw new Error("Cannot find module '" + specifier + "'"); }
      return mod;
    };
    var moduleObj = { exports: {} };
    var factory = new Function("require", "module", "exports", msg.compiledCode);
    factory(requireShim, moduleObj, moduleObj.exports);

    var definition = moduleObj.exports && (moduleObj.exports.default || moduleObj.exports.definition);
    if (!definition || typeof definition.render !== "function") {
      throw new Error("Component must export a default defineComponent({ ... })");
    }

    // describeComponent returns the strict §2 manifest plus a sibling hasPanel
    // flag (whether the definition declared a custom editor panel); the panel
    // function itself never crosses the boundary — only the flag does.
    var described = runtime.describeComponent(definition);
    var manifest = described.manifest;
    var hasPanel = described.hasPanel;
    var states = (manifest.previewStates && manifest.previewStates.length)
      ? manifest.previewStates : ["default"];
    var previewTrees = {};
    var chain = Promise.resolve();
    states.forEach(function (state) {
      chain = chain.then(function () {
        var fixture = (definition.previews && definition.previews[state]) || {};
        var hostData = Object.assign({}, runtime.defaultHostData(), fixture.data || {});
        return runtime.renderComponentToTree(definition, {
          state: state, props: fixture.props, hostData: hostData
        }).then(function (tree) { previewTrees[state] = tree; });
      });
    });
    return chain.then(function () {
      parent.postMessage({ type: "result", requestId: msg.requestId, ok: true,
        manifest: manifest, hasPanel: hasPanel, previewTrees: previewTrees }, "*");
    });
  }

  window.addEventListener("message", function (event) {
    var msg = event.data;
    if (!msg || msg.type !== "render") { return; }
    Promise.resolve().then(function () { return handle(msg); }).catch(function (err) {
      parent.postMessage({ type: "result", requestId: msg.requestId, ok: false,
        error: toMessage(err) }, "*");
    });
  });

  parent.postMessage({ type: "ready" }, "*");
})();
`;

export const SANDBOX_DOCUMENT = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; connect-src 'none';">
<script>${BOOTSTRAP}</script>
</head>
<body></body>
</html>`;
