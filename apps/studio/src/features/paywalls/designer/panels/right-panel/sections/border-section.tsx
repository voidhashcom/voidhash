"use client";

import type { PropertiesOfGroup } from "@voidhash/dff";
import { Schema } from "effect";
import {
	FullscreenIcon,
	MinusIcon,
	PanelBottomDashedIcon,
	PanelLeftDashedIcon,
	PanelRightDashedIcon,
	PanelTopDashedIcon,
	PlusIcon,
	RatioIcon,
	SquareDashedTopSolidIcon,
	SquareIcon,
	VaultIcon,
} from "lucide-react";
import { useState } from "react";
import { PanelButton } from "@/features/designer/components/button";
import { ColorInput } from "@/features/designer/components/color-input";
import {
	PanelSection,
	PanelSectionContent,
	PanelSectionHeader,
	PanelSectionHeaderActions,
	PanelSectionTitle,
	PanelSubSection,
	PanelSubSectionContent,
	PanelSubSectionTitle,
} from "@/features/designer/components/panel-section";
import type { NodeEditorProps, NodeWithProperties } from "../../types";
import { TextInput } from "../inputs/text-input";

/** Properties needed for the border section - derived from style groups */
type BorderPropertyNames = PropertiesOfGroup<"border">;

export interface BorderSectionProps
	extends NodeEditorProps<BorderPropertyNames> {
	onNodeChange: (node: NodeWithProperties<BorderPropertyNames>) => void;
}

function shouldShowIndividualBorder(
	node: NodeEditorProps<BorderPropertyNames>["node"],
) {
	return (
		node.borderWidthTop !== node.borderWidthBottom ||
		node.borderWidthTop !== node.borderWidthLeft ||
		node.borderWidthTop !== node.borderWidthRight ||
		node.borderWidthBottom !== node.borderWidthLeft ||
		node.borderWidthBottom !== node.borderWidthRight ||
		node.borderWidthLeft !== node.borderWidthRight
	);
}

export function BorderSection({ node, onNodeChange }: BorderSectionProps) {
	const [showIndividualBorder, setShowIndividualBorder] = useState(
		shouldShowIndividualBorder(node),
	);

	const handleColorChange = (rgba: string) => {
		onNodeChange({
			...node,
			borderColor: rgba,
		});
	};

	const expandBorder = () => {
		setShowIndividualBorder(true);
	};

	const collapseBorder = () => {
		setShowIndividualBorder(false);
		const allSidesValue = node.borderWidthTop;
		onNodeChange({
			...node,
			borderWidthLeft: allSidesValue,
			borderWidthRight: allSidesValue,
			borderWidthTop: allSidesValue,
			borderWidthBottom: allSidesValue,
		});
	};

	return (
		<PanelSection>
			<PanelSectionHeader>
				<PanelSectionTitle>Border</PanelSectionTitle>
				<PanelSectionHeaderActions>
					{!node.borderEnabled && (
						<PanelButton
							icon={<PlusIcon />}
							onClick={() => {
								onNodeChange({ ...node, borderEnabled: true });
							}}
							size="icon"
						/>
					)}
				</PanelSectionHeaderActions>
			</PanelSectionHeader>
			{node.borderEnabled && (
				<PanelSectionContent>
					<PanelSubSection>
						<PanelSubSectionTitle>Width</PanelSubSectionTitle>
						<PanelSubSectionContent>
							<div className="flex flex-row gap-2">
								{/* Single Border Input (Default) */}
								{!showIndividualBorder && (
									<TextInput
										icon={<SquareIcon className="size-3.5" />}
										label="Width"
										minValue={0}
										onChange={(value) => {
											const numValue = Number(value);
											onNodeChange({
												...node,
												borderWidthTop: numValue,
												borderWidthRight: numValue,
												borderWidthBottom: numValue,
												borderWidthLeft: numValue,
											});
										}}
										type="number"
										typeNumberStepIncrement={1}
										validator={Schema.String}
										value={node.borderWidthTop.toString()}
									/>
								)}

								{/* Individual Borders (Expanded) */}
								{showIndividualBorder && (
									<div className="flex flex-col gap-2">
										<div className="flex flex-row gap-2">
											<TextInput
												icon={
													<SquareDashedTopSolidIcon className="-rotate-90 size-3.5" />
												}
												label="Border Left"
												minValue={0}
												onChange={(value) =>
													onNodeChange({
														...node,
														borderWidthLeft: Number(value),
													})
												}
												type="number"
												typeNumberStepIncrement={1}
												validator={Schema.String}
												value={node.borderWidthLeft.toString()}
											/>
											<TextInput
												icon={<SquareDashedTopSolidIcon className="size-3.5" />}
												label="Border Top"
												minValue={0}
												onChange={(value) =>
													onNodeChange({
														...node,
														borderWidthTop: Number(value),
													})
												}
												type="number"
												typeNumberStepIncrement={1}
												validator={Schema.String}
												value={node.borderWidthTop.toString()}
											/>
										</div>
										<div className="flex flex-row gap-2">
											<TextInput
												icon={
													<SquareDashedTopSolidIcon className="rotate-90 size-3.5" />
												}
												label="Border Right"
												minValue={0}
												onChange={(value) =>
													onNodeChange({
														...node,
														borderWidthRight: Number(value),
													})
												}
												type="number"
												typeNumberStepIncrement={1}
												validator={Schema.String}
												value={node.borderWidthRight.toString()}
											/>
											<TextInput
												icon={
													<SquareDashedTopSolidIcon className="rotate-180 size-3.5" />
												}
												label="Border Bottom"
												minValue={0}
												onChange={(value) =>
													onNodeChange({
														...node,
														borderWidthBottom: Number(value),
													})
												}
												type="number"
												typeNumberStepIncrement={1}
												validator={Schema.String}
												value={node.borderWidthBottom.toString()}
											/>
										</div>
									</div>
								)}

								<PanelButton
									icon={
										showIndividualBorder ? (
											<VaultIcon className="size-3.5" />
										) : (
											<FullscreenIcon className="size-3.5" />
										)
									}
									onClick={() =>
										showIndividualBorder ? collapseBorder() : expandBorder()
									}
								/>

								<PanelButton
									icon={<MinusIcon />}
									onClick={() => {
										onNodeChange({ ...node, borderEnabled: false });
									}}
									size="icon"
								/>
							</div>
						</PanelSubSectionContent>
					</PanelSubSection>
					<ColorInput onChange={handleColorChange} value={node.borderColor} />
				</PanelSectionContent>
			)}
		</PanelSection>
	);
}
