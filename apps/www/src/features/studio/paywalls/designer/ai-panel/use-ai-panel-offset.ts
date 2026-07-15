"use client";

import { INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";
import { useStore } from "zustand/react";

import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";

import { usePaywallDesignerStore } from "../state/designer-store";

/** Return the AI panel width only when the feature is enabled and the panel is open. */
export function useAiPanelOffset(): number {
  const store = usePaywallDesignerStore();
  const enabled = useInternalFeatureFlag(INTERNAL_FEATURE_FLAGS.voidhashAiPi.key);

  return useStore(store, (state) => (enabled && state.ai.panelOpen ? state.ai.width : 0));
}
