import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useStore } from "zustand/react";

import { usePaywallDesignerStore } from "../../../state/designer-store";
import {
  createStyleOverrideResetContext,
  type StyleOverrideResetContext,
} from "./style-override-reset";

export function useStyleOverrideResetContext(nodes: SnapshotNode[]): StyleOverrideResetContext {
  const store = usePaywallDesignerStore();
  const stateOverrideSelection = useStore(store, (state) => state.stateOverrideSelection);

  return createStyleOverrideResetContext(nodes, stateOverrideSelection);
}
