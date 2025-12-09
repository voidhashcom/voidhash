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
						style: {
							...node.style,
							...updatedStyle,
							width: updatedStyle.width ?? node.style.width,
							height: updatedStyle.height ?? node.style.height,
						},
					})
				}
				editableDimensions={false}
				parentId={node.parent.id}
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
