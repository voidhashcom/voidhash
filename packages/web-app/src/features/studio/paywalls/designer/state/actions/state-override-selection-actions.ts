import { commander } from "../designer-commander";
import { setSelectedStateIdForNode } from "../utils/state-overrides";

export interface SetStateOverrideSelectionParams {
  nodeId: string;
  stateId: string | null;
}

export const setStateOverrideSelection = commander.action<SetStateOverrideSelectionParams>(
  (ctx, params) => {
    const state = ctx.getState();
    ctx.setState({
      stateOverrideSelection: setSelectedStateIdForNode(
        state.stateOverrideSelection,
        params.nodeId,
        params.stateId,
      ),
    });
  },
);
