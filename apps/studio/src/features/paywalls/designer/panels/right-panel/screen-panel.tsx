"use client";

import type { ScreenNodeData } from "@voidhash/dff";
import { usePaywallDesignerActions } from "../../state/designer-store";
import { FillSection } from "./sections/fill-section";
import { FlexLayoutSection } from "./sections/flex-layout-section";

const DISPATCH_ACTION = "updateScreenNode";
export function ScreenPanel({ node }: { node: ScreenNodeData }) {
	const dispatch = usePaywallDesignerActions();
	return (
		<>
			<FlexLayoutSection
				node={node.style}
				onNodeChange={(updatedStyle) =>
					dispatch(DISPATCH_ACTION, {
						...node,
						style: { ...node.style, ...updatedStyle },
					})
				}
				editableDimensions={false}
			/>
			<FillSection
				node={node.style}
				onNodeChange={(updatedStyle) =>
					dispatch(DISPATCH_ACTION, {
						...node,
						style: { ...node.style, ...updatedStyle },
					})
				}
			/>
		</>
	);
}
