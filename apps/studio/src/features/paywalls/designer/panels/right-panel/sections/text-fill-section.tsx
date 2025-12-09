"use client";

import { ColorInput } from "@/features/designer/components/color-input";
import {
	PanelSection,
	PanelSectionContent,
	PanelSectionHeader,
	PanelSectionTitle,
} from "@/features/designer/components/panel-section";
import type { NodeEditorProps } from "../../types";

/** Properties needed for the layout section - individual style properties */
type TextFillPropertyNames = "color";

export interface TextFillSectionProps
	extends NodeEditorProps<TextFillPropertyNames> {}

export function TextFillSection({ node, onNodeChange }: TextFillSectionProps) {
	const handleColorChange = (rgba: string) => {
		onNodeChange({
			...node,
			color: rgba,
		});
	};

	return (
		<PanelSection>
			<PanelSectionHeader>
				<PanelSectionTitle>Fill</PanelSectionTitle>
			</PanelSectionHeader>
			<PanelSectionContent>
				<ColorInput onChange={handleColorChange} value={node.color} />
			</PanelSectionContent>
		</PanelSection>
	);
}
