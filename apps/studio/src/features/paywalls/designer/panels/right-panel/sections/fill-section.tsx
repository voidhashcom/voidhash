"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { PanelButton } from "@/features/designer/components/button";
import { ColorInput } from "@/features/designer/components/color-input";
import {
	hexOpacityToRgba,
	rgbaToHexOpacity,
} from "@/features/designer/components/color-picker/color-utils";
import {
	PanelSection,
	PanelSectionContent,
	PanelSectionHeader,
	PanelSectionHeaderActions,
	PanelSectionTitle,
} from "@/features/designer/components/panel-section";
import {
	PanelToggleGroup,
	PanelToggleGroupItem,
} from "@/features/designer/components/toggle-group";
import type { NodeEditorProps } from "../../types";

/** Properties needed for the layout section - individual style properties */
type FillPropertyNames = "backgroundColor" | "backgroundEnabled";

export interface LayoutSectionProps
	extends NodeEditorProps<FillPropertyNames> {}

export function FillSection({ node, onNodeChange }: LayoutSectionProps) {
	const handleColorChange = (rgba: string) => {
		onNodeChange({
			...node,
			backgroundColor: rgba,
		});
	};

	return (
		<PanelSection>
			<PanelSectionHeader>
				<PanelSectionTitle>Fill</PanelSectionTitle>
				<PanelSectionHeaderActions>
					{!node.backgroundEnabled && (
						<PanelButton
							icon={<PlusIcon />}
							onClick={() => {
								onNodeChange({ ...node, backgroundEnabled: true });
							}}
							size="icon"
						/>
					)}
				</PanelSectionHeaderActions>
			</PanelSectionHeader>
			{node.backgroundEnabled && (
				<PanelSectionContent>
					<div className="flex flex-row gap-2 justify-between">
						<PanelToggleGroup type="single" value={"solid"}>
							<PanelToggleGroupItem className="flex-1" value="solid">
								Solid
							</PanelToggleGroupItem>
							<PanelToggleGroupItem
								className="flex-1"
								value="gradient"
								disabled
							>
								Gradient
							</PanelToggleGroupItem>
							<PanelToggleGroupItem
								className="flex-1"
								value="gradient"
								disabled
							>
								Image
							</PanelToggleGroupItem>
						</PanelToggleGroup>
						<PanelButton
							icon={<MinusIcon />}
							onClick={() => {
								onNodeChange({ ...node, backgroundEnabled: false });
							}}
							size="icon"
						/>
					</div>
					<ColorInput
						onChange={handleColorChange}
						value={node.backgroundColor}
					/>
				</PanelSectionContent>
			)}
		</PanelSection>
	);
}
