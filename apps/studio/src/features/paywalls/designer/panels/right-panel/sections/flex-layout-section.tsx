"use client";

import type { FlexDirection } from "@voidhash/mimic-schema";
import { Schema } from "effect";
import {
	ArrowDownIcon,
	ArrowRightIcon,
	BetweenHorizontalStartIcon,
	FullscreenIcon,
	PanelBottomDashedIcon,
	PanelLeftDashedIcon,
	PanelLeftRightDashedIcon,
	PanelRightDashedIcon,
	PanelTopBottomDashedIcon,
	PanelTopDashedIcon,
	VaultIcon,
} from "lucide-react";
import { useState } from "react";
import { useStore } from "zustand";
import { PanelButton } from "@/features/paywalls/designer/components/ui/button";
import {
	PanelSection,
	PanelSectionContent,
	PanelSectionHeader,
	PanelSectionTitle,
	PanelSubSection,
	PanelSubSectionContent,
	PanelSubSectionTitle,
} from "@/features/paywalls/designer/components/ui/panel-section";
import {
	PanelToggleGroup,
	PanelToggleGroupItem,
} from "@/features/paywalls/designer/components/ui/toggle-group";
import { usePaywallDesignerStore } from "../../../state/designer-store";
import { getNodeById } from "../../../state/utils/nodes";
import type { NodeEditorProps } from "../../types";
import { FlexAlignmentInput } from "../inputs/flex-alignment-input";
import { HeightInput } from "../inputs/height-input";
import { TextInput } from "../inputs/text-input";
import { WidthInput } from "../inputs/width-input";

/** Properties needed for the layout section - individual style properties */
type LayoutPropertyNames =
	| "gap"
	| "justifyContent"
	| "alignItems"
	| "flexDirection"
	| "paddingTop"
	| "paddingRight"
	| "paddingBottom"
	| "paddingLeft"
	| "width"
	| "height"
	| "flex"
	| "flexGrow"
	| "flexShrink"
	| "flexBasis"
	| "alignSelf";

export interface LayoutSectionProps
	extends NodeEditorProps<LayoutPropertyNames> {
	showDimensions?: boolean;
	editableDimensions?: boolean;
	parentId: string;
}

export function FlexLayoutSection({
	node,
	onNodeChange,
	parentId,
	showDimensions = true,
	editableDimensions = true,
}: LayoutSectionProps) {
	return (
		<PanelSection>
			<PanelSectionHeader>
				<PanelSectionTitle>Layout</PanelSectionTitle>
			</PanelSectionHeader>
			<PanelSectionContent>
				<FlexSubsection node={node} onNodeChange={onNodeChange} />
				{showDimensions && (
					<DimensionsSubSection
						editable={editableDimensions}
						node={node}
						onNodeChange={onNodeChange}
						parentId={parentId}
					/>
				)}
				<PaddingSubSection node={node} onNodeChange={onNodeChange} />
			</PanelSectionContent>
		</PanelSection>
	);
}

// ===============================
// Dimensions
// ===============================
type DimensionsPropertyNames =
	| "width"
	| "height"
	| "flex"
	| "flexGrow"
	| "flexShrink"
	| "flexBasis"
	| "alignSelf";
type DimensionsSubSectionProps = NodeEditorProps<DimensionsPropertyNames> & {
	editable?: boolean;
	parentId: string;
};
function DimensionsSubSection({
	node,
	onNodeChange,
	parentId,
	editable = true,
}: DimensionsSubSectionProps) {
	const store = usePaywallDesignerStore();
	// This is a hacky solution, because we don't have a way to get correct type here.
	const parent = useStore(store, (state) => getNodeById(state, parentId));

	if (!parent) {
		return null;
	}
	const parentDirection =
		parent.type === "flex" ? parent.style.flexDirection : "row";
	return (
		<PanelSubSection>
			<PanelSubSectionTitle>Dimensions</PanelSubSectionTitle>
			<PanelSubSectionContent>
				<div className="flex flex-row gap-2">
					<WidthInput
						disabled={!editable}
						node={node}
						onNodeChange={onNodeChange}
						parentDirection={parentDirection}
					/>
					<HeightInput
						disabled={!editable}
						node={node}
						onNodeChange={onNodeChange}
						parentDirection={parentDirection}
					/>
				</div>
			</PanelSubSectionContent>
		</PanelSubSection>
	);
}
// ===============================
// Flex
// ===============================
type FlexSubsectionProps = NodeEditorProps<
	"gap" | "justifyContent" | "alignItems" | "flexDirection"
>;

function FlexSubsection({ node, onNodeChange }: FlexSubsectionProps) {
	return (
		<PanelSubSection>
			<PanelSubSectionContent>
				<div className="flex flex-row gap-2">
					<div className="flex flex-col gap-2">
						<PanelToggleGroup
							onValueChange={(value) =>
								onNodeChange({ ...node, flexDirection: value as FlexDirection })
							}
							type="single"
							value={node.flexDirection}
						>
							<PanelToggleGroupItem className="flex-1" value="column">
								<ArrowDownIcon className="size-3.5" />
							</PanelToggleGroupItem>
							<PanelToggleGroupItem className="flex-1" value="row">
								<ArrowRightIcon className="size-3.5" />
							</PanelToggleGroupItem>
						</PanelToggleGroup>
						<TextInput
							icon={<BetweenHorizontalStartIcon className="size-3.5" />}
							label="Gap"
							onChange={(value) =>
								onNodeChange({ ...node, gap: Number(value) })
							}
							type="number"
							typeNumberStepIncrement={1}
							validator={Schema.String}
							value={node.gap.toString()}
						/>
					</div>
					<FlexAlignmentInput
						alignItems={node.alignItems}
						flexDirection={node.flexDirection}
						justifyContent={node.justifyContent}
						onChange={(value) =>
							onNodeChange({
								...node,
								alignItems: value.alignItems,
								justifyContent: value.justifyContent,
							})
						}
					/>
				</div>
			</PanelSubSectionContent>
		</PanelSubSection>
	);
}

// ===============================
// Padding Sub Section
// ===============================
type PaddingPropertyNames =
	| "paddingTop"
	| "paddingRight"
	| "paddingBottom"
	| "paddingLeft";

function shouldShowIndividualPadding(
	node: NodeEditorProps<PaddingPropertyNames>["node"],
) {
	return (
		node.paddingTop !== node.paddingBottom ||
		node.paddingLeft !== node.paddingRight
	);
}

type PaddingSubSectionProps = NodeEditorProps<PaddingPropertyNames>;
function PaddingSubSection({ node, onNodeChange }: PaddingSubSectionProps) {
	const [showIndividualPadding, setShowIndividualPadding] = useState(
		shouldShowIndividualPadding(node),
	);

	const expandPadding = () => {
		setShowIndividualPadding(true);
	};

	const collapsePadding = () => {
		setShowIndividualPadding(false);
		onNodeChange({
			...node,
			paddingLeft: node.paddingLeft,
			paddingRight: node.paddingLeft,
			paddingTop: node.paddingTop,
			paddingBottom: node.paddingTop,
		});
	};

	return (
		<PanelSubSection>
			<PanelSubSectionTitle>Padding</PanelSubSectionTitle>
			<PanelSubSectionContent>
				<div className="flex flex-row gap-2">
					{/* Individual Paddings */}
					{showIndividualPadding && (
						<div className="flex flex-col gap-2">
							<div className="flex flex-row gap-2">
								<TextInput
									icon={<PanelLeftDashedIcon className="size-3.5" />}
									label="Padding Left"
									onChange={(value) =>
										onNodeChange({ ...node, paddingLeft: Number(value) })
									}
									type="number"
									typeNumberStepIncrement={1}
									validator={Schema.String}
									value={node.paddingLeft.toString()}
								/>
								<TextInput
									icon={<PanelTopDashedIcon className="size-3.5" />}
									label="Padding Top"
									onChange={(value) =>
										onNodeChange({ ...node, paddingTop: Number(value) })
									}
									type="number"
									typeNumberStepIncrement={1}
									validator={Schema.String}
									value={node.paddingTop.toString()}
								/>
							</div>
							<div className="flex flex-row gap-2">
								<TextInput
									icon={<PanelRightDashedIcon className="size-3.5" />}
									label="Padding Right"
									onChange={(value) =>
										onNodeChange({ ...node, paddingRight: Number(value) })
									}
									type="number"
									typeNumberStepIncrement={1}
									validator={Schema.String}
									value={node.paddingRight.toString()}
								/>

								<TextInput
									icon={<PanelBottomDashedIcon className="size-3.5" />}
									label="Padding Bottom"
									onChange={(value) =>
										onNodeChange({ ...node, paddingBottom: Number(value) })
									}
									type="number"
									typeNumberStepIncrement={1}
									validator={Schema.String}
									value={node.paddingBottom.toString()}
								/>
							</div>
						</div>
					)}

					{/* Grouped Padding */}
					{!showIndividualPadding && (
						<div className="flex flex-col gap-2">
							<div className="flex flex-row gap-2">
								<TextInput
									icon={<PanelLeftRightDashedIcon className="size-3.5" />}
									label="Padding Horizontal"
									onChange={(value) =>
										onNodeChange({
											...node,
											paddingLeft: Number(value),
											paddingRight: Number(value),
										})
									}
									type="number"
									typeNumberStepIncrement={1}
									validator={Schema.String}
									value={node.paddingLeft.toString()}
								/>
								<TextInput
									icon={<PanelTopBottomDashedIcon className="size-3.5" />}
									label="Padding Top"
									onChange={(value) =>
										onNodeChange({
											...node,
											paddingTop: Number(value),
											paddingBottom: Number(value),
										})
									}
									type="number"
									typeNumberStepIncrement={1}
									validator={Schema.String}
									value={node.paddingTop.toString()}
								/>
							</div>
						</div>
					)}

					<PanelButton
						icon={
							showIndividualPadding ? (
								<VaultIcon className="size-3.5" />
							) : (
								<FullscreenIcon className="size-3.5" />
							)
						}
						onClick={() =>
							showIndividualPadding ? collapsePadding() : expandPadding()
						}
					/>
				</div>
			</PanelSubSectionContent>
		</PanelSubSection>
	);
}
