import type { DesignerStoreState } from "../designer-store-state";

/** Combines local chat state with connected agent presence from Mimic. */
export const selectAiWorking = (state: DesignerStoreState): boolean =>
  state.ai.localIsWorking ||
  [...(state.mimic.presence?.others.values() ?? [])].some(
    ({ data }) => data?.participant.kind === "agent",
  );
