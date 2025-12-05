"use client";

import type { FlexNodeData } from "@voidhash/dff";
import { useDesignerActions } from "../../state/designer-store";
import { BorderSection } from "./sections/border-section";
import { FillSection } from "./sections/fill-section";
import { LayoutSection } from "./sections/layout-section";

const DISPATCH_ACTION = "updateFlexNode";
export function FlexPanel({ node }: { node: FlexNodeData }) {
	const dispatch = useDesignerActions();
	return (
		<>
			<LayoutSection
				node={node}
				onNodeChange={(updatedNode) =>
					dispatch(DISPATCH_ACTION, { ...node, ...updatedNode })
				}
			/>
			<FillSection
				node={node}
				onNodeChange={(updatedNode) =>
					dispatch(DISPATCH_ACTION, { ...node, ...updatedNode })
				}
			/>
			<BorderSection
				node={node}
				onNodeChange={(updatedNode) =>
					dispatch(DISPATCH_ACTION, { ...node, ...updatedNode })
				}
			/>
		</>
	);
}
