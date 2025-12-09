import { createNodeAction, updateNodeAction } from "../core";
import { selectNode } from "../selection-actions";
import { setActiveTool } from "../tools-actions";
import type { DesignerStoreState } from "../types";

export const createTextNode = (storeState: DesignerStoreState) =>
	createNodeAction<"text">(storeState, "text", {
		after: ({ dispatch, node }) => {
			dispatch(selectNode)({ id: node.id, many: false });
			dispatch(setActiveTool)({ tool: "cursor" });
		},
	});

export const updateTextNode = (storeState: DesignerStoreState) =>
	updateNodeAction<"text">(storeState, "text");

export const createTextNodeActions = (storeState: DesignerStoreState) => ({
	createTextNode: createTextNode(storeState),
	updateTextNode: updateTextNode(storeState),
});
