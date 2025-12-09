"use client";

import type { TextNodeData } from "@voidhash/dff";
import { usePaywallDesignerActions } from "../../state/designer-store";
import { TextFillSection } from "./sections/text-fill-section";
import { TextSection } from "./sections/text-section";
import { TypographySection } from "./sections/typography-section";

export function TextPanel({ node }: { node: TextNodeData }) {
	const dispatch = usePaywallDesignerActions();

	const handleNodeChange = (updatedNode: typeof node.style) => {
		dispatch("updateTextNode", {
			...node,
			style: { ...node.style, ...updatedNode },
		});
	};

	const handleTextChange = (text: string) => {
		dispatch("updateTextNode", {
			...node,
			text,
		});
	};

	return (
		<>
			<TextSection value={node.text} onChange={handleTextChange} />
			<TypographySection node={node.style} onNodeChange={handleNodeChange} />
			<TextFillSection node={node.style} onNodeChange={handleNodeChange} />
		</>
	);
}
