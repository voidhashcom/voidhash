import { createNodeAction, updateNodeAction } from "../core";
import { selectNode } from "../selection-actions";
import { setActiveTool } from "../tools-actions";
import type { DesignerStoreState } from "../types";

export const createScreenNode = (storeState: DesignerStoreState) =>
	createNodeAction<"screen">(storeState, "screen", {
		after: ({ dispatch, node }) => {
			dispatch(selectNode)({ id: node.id, many: false });
			dispatch(setActiveTool)({ tool: "cursor" });
		},
	});

export const updateScreenNode = (storeState: DesignerStoreState) =>
	updateNodeAction<"screen">(storeState, "screen");

export const createScreenNodeActions = (storeState: DesignerStoreState) => ({
	createScreenNode: createScreenNode(storeState),
	updateScreenNode: updateScreenNode(storeState),
});
