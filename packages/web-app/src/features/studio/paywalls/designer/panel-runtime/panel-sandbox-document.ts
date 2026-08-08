/**
 * The LIVE panel sandbox iframe document. Unlike the preview sandbox (a one-shot,
 * clock-frozen render/response — {@link ../code-mode/sandbox-document}), this
 * document hosts a long-lived {@link createPanelSession}: React state, effects,
 * timers, and `requestAnimationFrame` all run for real, because a panel is
 * interactive. NOTHING here is frozen.
 *
 * Isolation is identical to the preview recipe: `<iframe sandbox="allow-scripts">`
 * (no `allow-same-origin` → opaque origin, no cookies/storage/parent DOM) and a
 * CSP with `default-src 'none'; connect-src 'none'` (no network). Untrusted
 * author code runs via `new Function` (hence `'unsafe-eval'`), but the opaque
 * origin + `connect-src 'none'` are the real boundary — it can only post data
 * the host re-validates.
 *
 * The bootstrap mirrors {@link createPanelSandboxDriver} (verified separately as
 * a module — jsdom can't run a srcdoc script). It cannot import that module (the
 * iframe loads no ES modules), so the protocol logic is inlined: on `panel/init`
 * it evals the OSS sandbox IIFE bundle, loads the compiled author module through
 * the require shim, resolves the `panel` function, and mounts a session with
 * rAF-coalesced tree emission; `panel/update`/`panel/event`/`panel/ping`/
 * `panel/unmount` drive the live session. Wrong-`sessionId` messages are ignored.
 *
 * The bootstrap is authored without backticks or `${` so it embeds safely in
 * this template literal.
 */
const BOOTSTRAP = `
(function () {
  var PROTOCOL = 1;
  var sessionId = null;
  var sandbox = null;
  var session = null;
  var pendingTree = null;
  var rafHandle = null;

  function ensureSandbox(code) {
    if (!sandbox && code) {
      (0, eval)(code);
      sandbox = window.__VOIDHASH_PAYWALLS_SANDBOX__;
    }
    return sandbox;
  }

  function toMessage(err) { return err && err.message ? String(err.message) : String(err); }

  function post(message) {
    message.protocol = PROTOCOL;
    message.sessionId = sessionId;
    parent.postMessage(message, "*");
  }

  function postError(phase, message) {
    post({ type: "panel/error", phase: phase, message: message });
  }

  function flushTree() {
    rafHandle = null;
    if (pendingTree === null) { return; }
    var payload = pendingTree;
    pendingTree = null;
    post({ type: "panel/tree", revision: payload.revision, tree: payload.tree });
  }

  function scheduleTree(revision, tree) {
    if (pendingTree === null || revision >= pendingTree.revision) {
      pendingTree = { revision: revision, tree: tree };
    }
    if (rafHandle === null) {
      rafHandle = window.requestAnimationFrame(flushTree);
    }
  }

  function disposeSession() {
    if (rafHandle !== null) { window.cancelAnimationFrame(rafHandle); rafHandle = null; }
    pendingTree = null;
    if (session) { try { session.dispose(); } catch (e) {} session = null; }
  }

  function loadDefinition(runtime, compiledCode) {
    var requireShim = function (specifier) {
      var mod = runtime.modules[specifier];
      if (mod === undefined) { throw new Error("Cannot find module '" + specifier + "'"); }
      return mod;
    };
    var moduleObj = { exports: {} };
    var factory = new Function("require", "module", "exports", compiledCode);
    factory(requireShim, moduleObj, moduleObj.exports);
    var definition = moduleObj.exports && (moduleObj.exports.default || moduleObj.exports.definition);
    if (!definition || typeof definition.render !== "function") {
      throw new Error("Component must export a default defineComponent({ ... })");
    }
    return definition;
  }

  function onInit(msg) {
    disposeSession();
    var runtime;
    try {
      runtime = ensureSandbox(msg.sandboxCode);
      if (!runtime) { throw new Error("panel sandbox runtime failed to load"); }
      var definition = loadDefinition(runtime, msg.compiledCode);
      var described = runtime.describeComponent(definition);
      if (!described.hasPanel || typeof definition.panel !== "function") {
        postError("init", "This component does not declare a custom panel.");
        return;
      }
      session = runtime.createPanelSession({
        render: definition.panel,
        initialInputs: msg.inputs,
        intentSink: function (intents) { post({ type: "panel/intent", intents: intents }); },
        callbacks: {
          onTree: function (tree, revision) { scheduleTree(revision, tree); },
          onError: function (error) { postError("render", toMessage(error)); }
        }
      });
    } catch (err) {
      postError("init", toMessage(err));
    }
  }

  function handle(msg) {
    if (!msg || msg.protocol !== PROTOCOL) { return; }
    if (msg.type === "panel/init") {
      // The first init fixes the session id for the whole document lifetime.
      sessionId = msg.sessionId;
      // Announce liveness carrying the pinned session id (a bare ready before
      // init would have no id and fail the host's strict envelope decode). This
      // arrives well within the host's init timeout.
      post({ type: "panel/ready" });
      onInit(msg);
      return;
    }
    // Every non-init message must match the established session id.
    if (msg.sessionId !== sessionId) { return; }
    if (msg.type === "panel/update") {
      if (session) { try { session.update(msg.inputs); } catch (e) { postError("runtime", toMessage(e)); } }
    } else if (msg.type === "panel/event") {
      if (session) {
        try { session.dispatchEvent(msg.nodeId, msg.name, msg.args); }
        catch (e) { postError("runtime", toMessage(e)); }
      }
    } else if (msg.type === "panel/ping") {
      post({ type: "panel/pong", seq: msg.seq });
    } else if (msg.type === "panel/unmount") {
      disposeSession();
    }
  }

  window.addEventListener("message", function (event) {
    try { handle(event.data); }
    catch (err) { postError("runtime", toMessage(err)); }
  });
})();
`;

/**
 * The srcdoc for the live panel sandbox iframe. Byte-for-byte the same CSP +
 * sandbox recipe as the preview document, but with the LIVE bootstrap (no clock
 * freeze). The host renders it via `<iframe sandbox="allow-scripts" srcdoc=…>`.
 */
export const PANEL_SANDBOX_DOCUMENT = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; connect-src 'none';">
<script>${BOOTSTRAP}</script>
</head>
<body></body>
</html>`;
