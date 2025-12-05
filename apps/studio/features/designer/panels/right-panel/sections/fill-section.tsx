"use client";

import type { PropertiesOfGroup } from "@voidhash/dff";
import { MinusIcon, PlusIcon } from "lucide-react";
import { PanelButton } from "../../core/components/button";
import { ColorInput } from "../../core/components/color-input";
import {
	hexOpacityToRgba,
	rgbaToHexOpacity,
} from "../../core/components/color-picker/color-utils";
import {
	PanelSection,
	PanelSectionContent,
	PanelSectionHeader,
	PanelSectionHeaderActions,
	PanelSectionTitle,
} from "../../core/components/panel-section";
import {
	PanelToggleGroup,
	PanelToggleGroupItem,
} from "../../core/components/toggle-group";
import type { NodeEditorProps } from "../../core/types";

/** Properties needed for the layout section - derived from style groups */
type FillPropertyNames = PropertiesOfGroup<"background">;

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
							variant="ghost"
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
							variant="ghost"
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
