"use client";

import type { FlexNodeData } from "@voidhash/dff";
import { useDesignerActions } from "../../state/designer-store";
import { LayoutSection } from "./sections/layout-section";

const DISPATCH_ACTION = "updateFlexNode";
export function FlexPanel({ node }: { node: FlexNodeData }) {
	const dispatch = useDesignerActions();
	return (
		<LayoutSection
			node={node}
			onNodeChange={(updatedNode) =>
				dispatch(DISPATCH_ACTION, { ...node, ...updatedNode })
			}
		/>
	);
}
