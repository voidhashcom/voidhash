import { commander } from "../designer-commander";
import type { CodeComponentCompiled } from "../designer-store-state";

/** Drops compiled state for definitions no longer in the document (deleted). */
export const pruneCodeComponentsCompiled = commander.action<{ keepIds: readonly string[] }>(
  (ctx, params) => {
    const state = ctx.getState();
    const keep = new Set(params.keepIds);
    const next: Record<string, CodeComponentCompiled> = {};
    let changed = false;
    for (const [id, compiled] of Object.entries(state.codeComponents.compiled)) {
      if (keep.has(id)) {
        next[id] = compiled;
      } else {
        changed = true;
      }
    }
    if (!changed) {
      return;
    }
    ctx.setState({ codeComponents: { ...state.codeComponents, compiled: next } });
  },
);

/** Appends `path` to `openTabs` when absent, preserving order. */
function appendTab(openTabs: readonly string[], path: string): string[] {
  return openTabs.includes(path) ? [...openTabs] : [...openTabs, path];
}

/**
 * Opens (activating) the editor tab for a workspace `path` — the composition
 * (`paywall.tsx`) or a component file. Appends it to `openTabs` when not already
 * open and resets the editor's preview-state selection so a newly opened
 * component falls back to its own default state. Browser-only (not synced, not
 * undoable).
 */
export const openTab = commander.action<{ path: string }>((ctx, params) => {
  const state = ctx.getState();
  const { codeComponents } = state;
  ctx.setState({
    codeComponents: {
      ...codeComponents,
      activeTabPath: params.path,
      previewState: null,
      openTabs: appendTab(codeComponents.openTabs, params.path),
    },
  });
});

/**
 * Closes an open editor tab (by workspace path). Removes it from `openTabs` and
 * drops its dirty flag. If it was the active tab, activates a neighbor from the
 * resulting list: the item that now sits at the closed index, else the previous
 * one; when no tabs remain, nothing is active. Browser-only (not synced, not
 * undoable).
 */
export const closeTab = commander.action<{ path: string }>((ctx, params) => {
  const state = ctx.getState();
  const { codeComponents } = state;
  const closedIndex = codeComponents.openTabs.indexOf(params.path);
  if (closedIndex === -1) {
    return;
  }

  const openTabs = codeComponents.openTabs.filter((path) => path !== params.path);
  const dirty = { ...codeComponents.dirty };
  delete dirty[params.path];

  if (params.path !== codeComponents.activeTabPath) {
    ctx.setState({ codeComponents: { ...codeComponents, openTabs, dirty } });
    return;
  }

  // Prefer the tab now occupying the closed slot; otherwise the previous one.
  const neighbor = openTabs[closedIndex] ?? openTabs[closedIndex - 1] ?? null;
  ctx.setState({
    codeComponents: {
      ...codeComponents,
      openTabs,
      dirty,
      previewState: null,
      activeTabPath: neighbor,
    },
  });
});

export interface SetCodeComponentCompiledParams {
  id: string;
  compiled: CodeComponentCompiled;
}

/** Stores the in-browser compilation result for a code-component definition. */
export const setCodeComponentCompiled = commander.action<SetCodeComponentCompiledParams>(
  (ctx, params) => {
    const state = ctx.getState();
    ctx.setState({
      codeComponents: {
        ...state.codeComponents,
        compiled: { ...state.codeComponents.compiled, [params.id]: params.compiled },
      },
    });
  },
);

/** Selects the preview state shown in the editor's live preview pane. */
export const setCodeEditorPreviewState = commander.action<{ state: string | null }>(
  (ctx, params) => {
    const state = ctx.getState();
    ctx.setState({
      codeComponents: { ...state.codeComponents, previewState: params.state },
    });
  },
);

/**
 * Sets the unsaved-changes flag for one editor tab (a workspace path). The Monaco
 * pane derives dirtiness from its buffer content vs the document `source` and
 * mirrors it here so the tab bar + file tree can render the unsaved dot without
 * reading Monaco. Browser-only (not synced, not undoable).
 */
export const setCodeComponentDirty = commander.action<{ path: string; dirty: boolean }>(
  (ctx, params) => {
    const state = ctx.getState();
    const current = state.codeComponents.dirty[params.path] ?? false;
    if (current === params.dirty) {
      return;
    }
    const dirty = { ...state.codeComponents.dirty };
    if (params.dirty) {
      dirty[params.path] = true;
    } else {
      delete dirty[params.path];
    }
    ctx.setState({ codeComponents: { ...state.codeComponents, dirty } });
  },
);
