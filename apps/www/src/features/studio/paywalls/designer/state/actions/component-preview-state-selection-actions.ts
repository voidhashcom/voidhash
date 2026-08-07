import { commander } from "../designer-commander";

export interface SetComponentPreviewStateSelectionParams {
  nodeId: string;
  /** Preview state name to select locally; `null` clears back to the node's persisted `previewState`. */
  previewState: string | null;
}

export const setComponentPreviewStateSelection =
  commander.action<SetComponentPreviewStateSelectionParams>((ctx, params) => {
    const state = ctx.getState();
    const next = { ...state.componentPreviewStateSelection };
    if (params.previewState === null) {
      delete next[params.nodeId];
    } else {
      next[params.nodeId] = params.previewState;
    }
    ctx.setState({
      componentPreviewStateSelection: next,
    });
  });
