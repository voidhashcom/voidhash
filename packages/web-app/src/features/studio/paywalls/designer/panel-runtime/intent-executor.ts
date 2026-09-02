/**
 * The host-side reducer for the {@link PanelIntent} stream a component-panel
 * session emits. It is the trust boundary between an untrusted sandbox panel and
 * the designer document: EVERY intent is strictly decoded, validated against the
 * component's manifest (a panel can only write props the manifest declares, with
 * kind-compatible, capped values), rate-limited, and — for `live` drags —
 * coalesced per prop per frame before it reaches a batched commander action.
 *
 * Writes always target ALL current write targets (the selected component nodes)
 * through the batched {@link updateComponentPropBindingForNodes} /
 * {@link removeComponentPropForNodes} actions, so a multi-selection edit is one
 * undoable step. Drags are paired to a host draft via the
 * {@link PanelGestureController}: the first `live` opens the draft (the slot wires
 * `attachDraftPairing`), each `live` dispatches into it, and a `gesture-commit`
 * commits the whole drag as one undo entry (`gesture-discard`, session death, a
 * selection change, or 10s of inactivity discards it).
 *
 * Rejections are deliberately SILENT to the user (a dropped write is not a toast-
 * worthy event — bind chrome, read-only props, and oversized values are the
 * panel author's bug, surfaced with a dev-only console warning and counted for
 * the caller). Only genuine host-service failures would toast.
 */
import type {
  ComponentManifest,
  ComponentPropDefinition,
} from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";

import type { CommandDispatch } from "@voidhash/mimic/zustand-commander";
import type { PaywallDesignerDocument } from "@voidhash/mimic-schema";

import {
  removeComponentPropForNodes,
  updateComponentPropBindingForNodes,
} from "../state/actions/features/component-prop-actions";
import type { DesignerStoreState } from "../state/designer-store-state";
import type {
  ComponentPropBindingPlain,
  ComponentPropValuePlain,
} from "../state/utils/component-prop-values";
import type { PanelGestureController } from "./gesture-controller";
import { decodePanelIntent, type PanelIntent, type PanelJsonValue } from "./schema";

const isDev = import.meta.env.DEV;

const devWarn = (message: string): void => {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.warn(`[intent-executor] ${message}`);
  }
};

/** Max intents processed per rolling second before excess is dropped. */
const RATE_LIMIT_PER_SECOND = 240;
const RATE_WINDOW_MS = 1000;

/** Finer per-kind value caps applied on top of the 32KB decode cap. */
const STRING_VALUE_MAX = 4096;
const ARRAY_ITEMS_MAX = 200;

/** A minimal product view: only the id is needed to validate a `set-ref`. */
export interface ExecutorProduct {
  readonly id: string;
}

/** A single write target: the component node the executor writes props onto. */
export interface ExecutorTarget {
  readonly nodeId: string;
}

/**
 * The store-scoped dispatch the executor uses — the designer store's commander
 * dispatch (`dispatch(command)(params)`). Draft-awareness lives in the store
 * (`_commander.activeDraft`), so a dispatch during an open draft stages into the
 * draft automatically (no undo entry until commit).
 */
export type ExecutorDispatch = CommandDispatch<DesignerStoreState, typeof PaywallDesignerDocument>;

/** Options for {@link createIntentExecutor}. */
export interface CreateIntentExecutorOptions {
  /** The current write targets (selected component node ids); read per intent. */
  getTargets: () => readonly ExecutorTarget[];
  /** The resolved manifest for the selected component (undefined while resolving). */
  getManifest: () => ComponentManifest | undefined;
  /** The products a `set-ref` may reference (read per intent). */
  getProducts: () => readonly ExecutorProduct[];
  /** The gesture controller pairing live drags to a host draft. */
  gestures: PanelGestureController;
  /** Host services (only `toastError` is used, for genuine failures). */
  services: { toastError: (message: string) => void };
  /** The designer store's commander dispatch. */
  dispatch: ExecutorDispatch;
  /**
   * True when the named prop is variable-bound on ANY current target — the host
   * owns bind/unbind chrome, so a guest `set-prop`/`set-ref`/`reset-prop` on a
   * bound prop is dropped. Defaults to "never bound" when omitted.
   */
  isPropBound?: (propName: string) => boolean;
  /**
   * Frame scheduler for coalescing `live` set-props (defaults to
   * `requestAnimationFrame`, falling back to a macrotask). Injectable for tests.
   */
  scheduleFrame?: (fn: () => void) => void;
  /** Clock seam for the rate limiter (defaults to `Date.now`). Injectable for tests. */
  now?: () => number;
}

/** The executor handle the host wires the transport's `onIntents` to. */
export interface IntentExecutor {
  /** Decodes + validates + applies one raw intent from the sandbox. */
  handle(raw: unknown): void;
  /** The count of intents rejected so far (decode, validation, rate cap). */
  rejectedCount(): number;
  /** Flushes any pending coalesced live write immediately (test seam). */
  flush(): void;
  /** Releases pending frames + timers. */
  dispose(): void;
}

/** Wraps a plain scalar/array value into the plain binding literal for `set-prop`. */
function literalBinding(value: ComponentPropValuePlain): ComponentPropBindingPlain {
  return { type: "literal", value };
}

/**
 * Validates a `set-prop` value against the manifest prop definition and returns
 * the plain binding to write, or `undefined` (rejected — with a dev warning).
 * Enforces the finer per-kind caps on top of the 32KB decode cap: strings
 * ≤4096, arrays ≤200 homogeneous items, select ∈ options, numbers finite.
 * Component and ref-array / code-configured kinds are read-only (rejected).
 */
function validateSetPropBinding(
  def: ComponentPropDefinition,
  value: PanelJsonValue,
): ComponentPropBindingPlain | undefined {
  switch (def.kind) {
    case "string":
    case "image": {
      if (typeof value !== "string") return undefined;
      if (value.length > STRING_VALUE_MAX) return undefined;
      return literalBinding({ key: "string", value });
    }
    case "select": {
      if (typeof value !== "string") return undefined;
      if (value.length > STRING_VALUE_MAX) return undefined;
      if (!def.options.includes(value)) return undefined;
      return literalBinding({ key: "string", value });
    }
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
      return literalBinding({ key: "number", value });
    }
    case "boolean": {
      if (typeof value !== "boolean") return undefined;
      return literalBinding({ key: "boolean", value });
    }
    case "array": {
      if (!Array.isArray(value)) return undefined;
      if (value.length > ARRAY_ITEMS_MAX) return undefined;
      switch (def.item.kind) {
        case "string":
        case "image": {
          if (!value.every((item) => typeof item === "string")) return undefined;
          if (!value.every((item) => (item as string).length <= STRING_VALUE_MAX)) return undefined;
          return literalBinding({ key: "string-array", value: value as string[] });
        }
        case "select": {
          const options = def.item.options;
          if (!value.every((item) => typeof item === "string" && options.includes(item))) {
            return undefined;
          }
          return literalBinding({ key: "string-array", value: value as string[] });
        }
        case "number": {
          if (!value.every((item) => typeof item === "number" && Number.isFinite(item))) {
            return undefined;
          }
          return literalBinding({ key: "number-array", value: value as number[] });
        }
        case "boolean": {
          if (!value.every((item) => typeof item === "boolean")) return undefined;
          return literalBinding({ key: "boolean-array", value: value as boolean[] });
        }
        // Arrays of component/ref are configured in code — read-only.
        default:
          return undefined;
      }
    }
    // component + ref are handled elsewhere (ref via set-ref); component is
    // read-only.
    default:
      return undefined;
  }
}

/**
 * Creates the host-side intent executor for a component-panel session. The
 * transport's `onIntents(raw)` feeds each raw intent to {@link IntentExecutor.handle}.
 */
export const createIntentExecutor = (options: CreateIntentExecutorOptions): IntentExecutor => {
  const scheduleFrame =
    options.scheduleFrame ??
    ((fn: () => void) => {
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(fn);
      else setTimeout(fn, 16);
    });
  const now = options.now ?? (() => Date.now());

  let rejected = 0;
  let disposed = false;

  // Rate limiter: a sliding window of processing timestamps.
  const recentTimestamps: number[] = [];

  // Live-set coalescing: at most one pending write per prop name per frame.
  const pendingLive = new Map<string, ComponentPropBindingPlain>();
  let frameScheduled = false;

  /** True when any current target has the prop variable-bound (host owns bind chrome). */
  const propIsBound = (propName: string): boolean => options.isPropBound?.(propName) ?? false;

  const flushLive = (): void => {
    frameScheduled = false;
    if (disposed || pendingLive.size === 0) return;
    const nodeIds = options.getTargets().map((t) => t.nodeId);
    if (nodeIds.length === 0) {
      pendingLive.clear();
      return;
    }
    // Open the draft on the first applied live write of a gesture (idempotent).
    options.gestures.onLiveIntent();
    for (const [propName, binding] of pendingLive) {
      options.dispatch(updateComponentPropBindingForNodes)({ nodeIds, propName, binding });
    }
    pendingLive.clear();
  };

  const scheduleFlush = (): void => {
    if (frameScheduled || disposed) return;
    frameScheduled = true;
    scheduleFrame(flushLive);
  };

  /** Applies a committed set-prop write immediately (one undo entry when no draft). */
  const applyCommitWrite = (propName: string, binding: ComponentPropBindingPlain): void => {
    // If a live coalesced write for this prop is pending, the commit value
    // supersedes it — drop the stale pending entry.
    pendingLive.delete(propName);
    const nodeIds = options.getTargets().map((t) => t.nodeId);
    if (nodeIds.length === 0) return;
    options.dispatch(updateComponentPropBindingForNodes)({ nodeIds, propName, binding });
  };

  const handleSetProp = (intent: Extract<PanelIntent, { type: "set-prop" }>): void => {
    const manifest = options.getManifest();
    const def = manifest?.props[intent.name];
    if (def === undefined) {
      rejected += 1;
      devWarn(`set-prop for unknown prop "${intent.name}" dropped`);
      return;
    }
    if (propIsBound(intent.name)) {
      rejected += 1;
      devWarn(`set-prop for bound prop "${intent.name}" dropped (host owns binding)`);
      return;
    }
    const binding = validateSetPropBinding(def, intent.value);
    if (binding === undefined) {
      rejected += 1;
      devWarn(`set-prop for "${intent.name}" rejected (kind/value incompatible)`);
      return;
    }
    if (intent.gesture === "live") {
      pendingLive.set(intent.name, binding);
      scheduleFlush();
      return;
    }
    applyCommitWrite(intent.name, binding);
  };

  const handleSetRef = (intent: Extract<PanelIntent, { type: "set-ref" }>): void => {
    const manifest = options.getManifest();
    const def = manifest?.props[intent.name];
    if (def === undefined || def.kind !== "ref") {
      rejected += 1;
      devWarn(`set-ref for non-ref prop "${intent.name}" dropped`);
      return;
    }
    if (propIsBound(intent.name)) {
      rejected += 1;
      devWarn(`set-ref for bound prop "${intent.name}" dropped (host owns binding)`);
      return;
    }
    if (!options.getProducts().some((product) => product.id === intent.productId)) {
      rejected += 1;
      devWarn(`set-ref referenced unknown product "${intent.productId}" — dropped`);
      return;
    }
    const nodeIds = options.getTargets().map((t) => t.nodeId);
    if (nodeIds.length === 0) return;
    const binding: ComponentPropBindingPlain = {
      type: "literal",
      value: { key: "product", value: { productId: intent.productId } },
    };
    options.dispatch(updateComponentPropBindingForNodes)({
      nodeIds,
      propName: intent.name,
      binding,
    });
  };

  const handleResetProp = (intent: Extract<PanelIntent, { type: "reset-prop" }>): void => {
    if (propIsBound(intent.name)) {
      rejected += 1;
      devWarn(`reset-prop for bound prop "${intent.name}" dropped (host owns binding)`);
      return;
    }
    pendingLive.delete(intent.name);
    const nodeIds = options.getTargets().map((t) => t.nodeId);
    if (nodeIds.length === 0) return;
    options.dispatch(removeComponentPropForNodes)({ nodeIds, propName: intent.name });
  };

  const apply = (intent: PanelIntent): void => {
    switch (intent.type) {
      case "set-prop":
        handleSetProp(intent);
        return;
      case "set-ref":
        handleSetRef(intent);
        return;
      case "reset-prop":
        handleResetProp(intent);
        return;
      case "gesture-commit":
        // Flush any pending coalesced live write so the committed draft carries
        // the final value, then commit the draft.
        flushLive();
        options.gestures.onGestureCommit();
        return;
      case "gesture-discard":
        pendingLive.clear();
        options.gestures.onGestureDiscard();
        return;
    }
  };

  /** Returns true when a fresh intent may be processed (drops beyond the cap). */
  const withinRateLimit = (): boolean => {
    const t = now();
    const cutoff = t - RATE_WINDOW_MS;
    while (recentTimestamps.length > 0 && recentTimestamps[0]! < cutoff) {
      recentTimestamps.shift();
    }
    if (recentTimestamps.length >= RATE_LIMIT_PER_SECOND) return false;
    recentTimestamps.push(t);
    return true;
  };

  return {
    handle(raw) {
      if (disposed) return;
      const decoded = decodePanelIntent(raw);
      if (!decoded.ok) {
        rejected += 1;
        devWarn(`intent rejected at decode: ${decoded.error}`);
        return;
      }
      if (!withinRateLimit()) {
        rejected += 1;
        devWarn("intent dropped (rate cap exceeded)");
        return;
      }
      apply(decoded.intent);
    },
    rejectedCount() {
      return rejected;
    },
    flush() {
      flushLive();
    },
    dispose() {
      disposed = true;
      pendingLive.clear();
      recentTimestamps.length = 0;
    },
  };
};
