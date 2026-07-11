import type { ClientDocument } from "@voidhash/mimic/client";
import type { MimicObject } from "@voidhash/mimic/zustand";
import type { ComponentManifest } from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import type {
  PaywallDesignerDocument,
  PresenceInput,
  PresenceSnapshot,
} from "@voidhash/mimic-schema";
import type { PreviewTree } from "@voidhash/paywall-renderer-web-core";

type StateStyleOverrideSnapshot = Record<string, unknown>;

/**
 * The designer's client document, carrying the full presence typing
 * (decoded `PresenceSnapshot` reads, `PresenceInput` writes). The
 * `| undefined` halves mirror the optional presence primitive exactly as
 * `createClientDocument` infers it.
 */
export type DesignerDocument = ClientDocument<
  typeof PaywallDesignerDocument,
  PresenceSnapshot | undefined,
  PresenceInput | undefined
>;

/** The store's `mimic` slice, matching the middleware's inferred typing. */
export type DesignerMimicObject = MimicObject<
  typeof PaywallDesignerDocument,
  PresenceSnapshot | undefined,
  PresenceInput | undefined
>;

export type AvailableTool = "cursor" | "text" | "rows" | "columns" | "scroll-view";

export type DesignerMode = "design" | "preview" | "code" | "translation";

export type DevModeTab = "snapshot" | "presence" | "actions";

/**
 * Remembers the currently selected override state per node.
 * Missing entries imply "Default" (no selected state override).
 */
export type StateOverrideSelection = Record<string, string | null>;

/**
 * Remembers the locally selected preview state per component node id.
 * Missing entries fall back to the node's persisted `previewState`.
 */
export type ComponentPreviewStateSelection = Record<string, string>;

/**
 * One catalog version detail with its §2 manifest already decoded.
 * Mirrors `RpcPaywallComponentVersion` (the raw `manifest: unknown` replaced
 * by the decoded `ComponentManifest`).
 */
export interface ComponentCatalogVersion {
  slug: string;
  version: number;
  contentHash: string;
  manifest: ComponentManifest;
  hasPanel: boolean;
  previewStates: readonly string[];
  artifactBaseUrl: string;
  createdAt: Date;
}

/** One component in the project catalog, keyed by slug. */
export interface ComponentCatalogEntry {
  slug: string;
  title: string | null;
  latestVersion: number;
  latest: ComponentCatalogVersion;
}

export type ComponentCatalogByContentHash = Record<string, ComponentCatalogVersion>;

/**
 * The in-browser compilation output for a local code component: a manifest
 * (derived from `defineComponent`) plus one preview tree per declared state.
 * Same shape the deployed-catalog path resolves, so the trusted
 * `PreviewTreeRenderer` consumes both identically.
 */
export interface LocalComponentArtifact {
  manifest: ComponentManifest;
  previewTrees: Record<string, PreviewTree>;
  /** Whether the definition declared a custom editor panel (`defineComponent({ panel })`). */
  hasPanel: boolean;
  /**
   * The compiled author CJS module, retained ONLY when `hasPanel` — the panel
   * sandbox evaluates it to drive the live panel session. `undefined` for
   * panel-less components (host-generated panel only). Never touches the canvas.
   */
  code?: string;
}

/** A compile/runtime diagnostic surfaced to the editor (Monaco markers + panel). */
export interface CompileDiagnostic {
  message: string;
  line?: number;
  column?: number;
  phase: "compile" | "runtime";
}

/**
 * Compilation state for one code-component definition, keyed by node id.
 * `sourceHash` guards against showing artifacts stale relative to the current
 * source. Ephemeral — derived from `source`, never stored in the document.
 */
export interface CodeComponentCompiled {
  status: "idle" | "compiling" | "ready" | "error";
  sourceHash: string;
  artifact?: LocalComponentArtifact;
  diagnostics?: CompileDiagnostic[];
  error?: string;
}

/**
 * Browser-only slice for the code-component editor: compiled artifacts keyed by
 * definition id, which component the Monaco editor currently has open, the
 * preview state selected in the editor's preview pane, and the open-tab / dirty
 * bookkeeping. Component source lives directly on the `codeComponent` document
 * nodes (there is no fork); a tab is dirty when its Monaco buffer differs from
 * the saved node source.
 */
export interface CodeComponentsState {
  compiled: Record<string, CodeComponentCompiled>;
  previewState: string | null;
  /**
   * The workspace PATH of the active editor tab (a component file), or `null`
   * when no tab is open. The preview panes resolve a component path to its
   * definition id for the compiled-artifact lookup.
   */
  activeTabPath: string | null;
  /** Ordered list of open editor tab keys. Each entry is a component workspace PATH. */
  openTabs: string[];
  /** Per tab key (workspace path); `true` = the Monaco buffer has unsaved changes. */
  dirty: Record<string, boolean>;
}

/**
 * Synchronous mirror of the tanstack-query component catalog so store/action
 * code (slot gates, insertion, validation) can read manifests without async
 * plumbing. `byContentHash` additionally holds pinned versions fetched for
 * component nodes whose contentHash is not the latest. Missing entries mean
 * "not (yet) in the catalog" — gates allow, validation reports.
 */
export interface ComponentCatalog {
  components: Record<string, ComponentCatalogEntry>;
  byContentHash: ComponentCatalogByContentHash;
}

export interface DragSelectState {
  isActive: boolean;
  startPoint: { x: number; y: number } | null;
  currentPoint: { x: number; y: number } | null;
  /** Node IDs that would be selected if drag ends now (preview) */
  previewSelectedNodeIds: string[];
}

/** A point in screen or canvas coordinates (context-dependent). */
export interface Point {
  x: number;
  y: number;
}

/**
 * Transient state for a canvas drag-to-move of absolutely positioned view
 * nodes. Populated by `startMove`, applied by `updateMove`/`endMove`, and reset
 * by `endMove`/`cancelMove`.
 */
export interface MoveState {
  isActive: boolean;
  /** Pointer position in screen coordinates when the move started. */
  startScreenPoint: Point | null;
  /**
   * Per dragged view node: `base*` are the node's `left`/`top` at drag start
   * (delta is added to these), `original*` mirror the stored style values
   * (`"auto"` = unset) captured for undo restore. `stateId` is the selected
   * state override the drag writes into (present only while one is selected);
   * `originalStateOverrideStyle` is that state's full `overrides.style` record
   * at drag start, so undo restores the override layer faithfully.
   */
  nodes: Record<
    string,
    {
      baseLeft: number;
      baseTop: number;
      originalLeft: number | "auto";
      originalTop: number | "auto";
      stateId: string | null;
      originalStateOverrideStyle: Record<string, unknown>;
    }
  >;
}

// Corner handles (2D scaling) and edge handles (1D scaling)
export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export interface ResizeState {
  isActive: boolean;
  handle: ResizeHandle | null;
  /** Starting mouse position in screen coordinates */
  startScreenPoint: { x: number; y: number } | null;
  /** The combined bounding box of all selected nodes at resize start */
  initialCombinedBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  /** Original numeric dimensions for each selected node (nodeId -> dimensions) */
  initialNodeDimensions: Record<
    string,
    {
      width: number | null;
      height: number | null;
      type: "screen" | "view" | "scrollView" | "text" | "shape";
    }
  >;
  /**
   * Original document state for undo. `width`/`height` mirror the stored
   * style values (`"auto"` = hug contents); an absent `flex` means the field
   * is unset on the node.
   */
  originalDocumentState: Record<
    string,
    {
      width: number | "auto";
      height: number | "auto";
      flex: number | undefined;
      alignSelf: string;
      type: "screen" | "view" | "scrollView" | "text" | "shape";
    }
  >;
  /** Nodes that should write resize updates to selected state overrides */
  stateOverrideTargets: Record<string, string>;
  /** Original style overrides for nodes written in state override mode */
  originalStateOverrideStyles: Record<string, StateStyleOverrideSnapshot>;
  /** Current dimensions during active resize */
  currentNodeDimensions: Record<
    string,
    {
      width: number | null;
      height: number | null;
      type: "screen" | "view" | "scrollView" | "text" | "shape";
    }
  >;
}

export type DesignerStoreState = {
  readonly mimic: DesignerMimicObject;
} & {
  mode: DesignerMode;
  previewScale: number;
  debug: {
    showGrid: boolean;
  };
  highlightedNodeId: string | null;
  textEditingNodeId: string | null;
  tools: {
    activeTool: string;
  };
  canvas: {
    scale: number;
    x: number;
    y: number;
    boundingBoxes: Record<string, { x: number; y: number; width: number; height: number }>;
  };
  viewport: {
    panels: {
      top: { height: number };
      bottom: { height: number };
      left: { width: number };
      right: { width: number };
    };
  };
  devMode: {
    enabled: boolean;
    activeTab: DevModeTab;
  };
  ai: {
    panelOpen: boolean;
    /** Current width of the AI chat panel in px (user-resizable). */
    width: number;
  };
  stateOverrideSelection: StateOverrideSelection;
  /**
   * The locale currently being edited/previewed, or `null` for the document's
   * default locale (today's behavior). A view-time override — like
   * `stateOverrideSelection`, it changes what the canvas renders and where
   * inline edits land, without touching the document until a write happens.
   */
  activeLocale: string | null;
  componentPreviewStateSelection: ComponentPreviewStateSelection;
  componentCatalog: ComponentCatalog;
  codeComponents: CodeComponentsState;
  dragSelect: DragSelectState;
  resize: ResizeState;
  move: MoveState;
};
