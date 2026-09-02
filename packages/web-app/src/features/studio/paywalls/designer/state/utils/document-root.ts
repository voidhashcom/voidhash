import { Effect } from "effect";

import type { CommanderSlice } from "@voidhash/mimic/zustand-commander";
import type { RootSnapshotNode } from "@voidhash/paywall-renderer-web-core";

import type { DesignerStoreState } from "../designer-store-state";

type DocumentRoots = DesignerStoreState["mimic"]["snapshot"];

/**
 * Runtime-validated narrowing of an engine root snapshot to web-core's
 * discriminated `RootSnapshotNode`. The shapes are identical at runtime —
 * the engine types its child arrays as one union-typed node while web-core
 * distributes the union per variant — so checking the root discriminator is
 * the whole conversion.
 */
function isRootSnapshotNode(value: unknown): value is RootSnapshotNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "root" &&
    "children" in value
  );
}

/**
 * Unwraps the engine's roots-array snapshot to the designer's single document
 * root. Dies when the document is not ready or malformed — call sites must
 * sit behind the `mimic.isReady` gate, which discharges both conditions.
 *
 * The selector chain built on this is synchronous (zustand selectors, React
 * render), so the defect is raised through `Effect.runSync` rather than being
 * returned as an effect.
 */
export function documentRootFromSnapshot(snapshot: DocumentRoots): RootSnapshotNode {
  if (snapshot === undefined) {
    return Effect.runSync(Effect.die(new Error("Designer document snapshot is not ready")));
  }
  const root: unknown = snapshot[0];
  if (root === undefined || snapshot.length !== 1) {
    return Effect.runSync(
      Effect.die(new Error(`Designer document must have exactly one root, got ${snapshot.length}`)),
    );
  }
  if (!isRootSnapshotNode(root)) {
    return Effect.runSync(Effect.die(new Error("Designer document root is not a root node")));
  }
  return root;
}

/**
 * Typed single-root selector over the store state. The returned node is the
 * `root` document node in the nested `{id, type, parentId, pos, data,
 * children}` snapshot shape.
 */
export function selectDocumentRoot(state: Pick<DesignerStoreState, "mimic">): RootSnapshotNode {
  return documentRootFromSnapshot(state.mimic.snapshot);
}

/**
 * Render-time root selector that prefers the active draft's staged snapshot.
 *
 * A deferred style edit (e.g. dragging a colour in a panel) runs inside a
 * mimic draft: its writes land in the draft and never touch the committed
 * document, so `mimic.snapshot` — and therefore `selectDocumentRoot` — stays
 * on the pre-edit value until commit. The canvas selects through this instead
 * so those in-progress edits render live (optimistically); when the draft
 * commits or discards it clears and this falls back to the committed snapshot.
 *
 * Action logic keeps reading `selectDocumentRoot` (the committed base) so undo
 * capture and change detection stay anchored to the real document state.
 */
export function selectRenderRoot(
  state: Pick<DesignerStoreState, "mimic"> & Partial<CommanderSlice>,
): RootSnapshotNode {
  const draftSnapshot = state._commander?.activeDraft?.getSnapshot();
  return documentRootFromSnapshot(draftSnapshot ?? state.mimic.snapshot);
}
