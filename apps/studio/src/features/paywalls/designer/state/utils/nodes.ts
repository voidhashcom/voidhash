import { TreeHelpers } from "@voidhash/mimic";
import type { AnyNodeData } from "@voidhash/mimic-schema";

import type { PaywallDesignerStoreType } from "../designer-store";

type StoreData = PaywallDesignerStoreType;

export const getNodeById = (
  state: ReturnType<StoreData["getState"]>,
  id: string
) => {
  const treeSnapshot = state.mimic.snapshot;
  return TreeHelpers.findNodeById(treeSnapshot, id) as unknown as AnyNodeData;
};
