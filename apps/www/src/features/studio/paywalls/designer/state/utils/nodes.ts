import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";

import type { PaywallDesignerStoreType } from "../designer-store";
import { documentRootFromSnapshot } from "./document-root";
import { findNodeById } from "./tree";

type StoreData = PaywallDesignerStoreType;

/**
 * Finds a node by id in the store's document snapshot. Must be called behind
 * the `mimic.isReady` gate (the snapshot selector throws pre-ready).
 */
export const getNodeById = (
  state: ReturnType<StoreData["getState"]>,
  id: string,
): SnapshotNode | null => {
  return findNodeById<SnapshotNode>(documentRootFromSnapshot(state.mimic.snapshot), id);
};
