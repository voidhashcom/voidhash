import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

/**
 * Wires Monaco's web workers through Vite's `?worker` imports. Side-effect
 * import — pull it in once before the editor mounts (client-only).
 * `MonacoEnvironment` is declared globally by monaco-editor's own types.
 */
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    if (label === "typescript" || label === "javascript") {
      return new tsWorker();
    }
    return new editorWorker();
  },
};
