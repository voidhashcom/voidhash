"use client";

import type {
	alignItems,
	flexDirection,
	gap,
	justifyContent,
	paddingBottom,
	paddingLeft,
	paddingRight,
	paddingTop,
} from "@voidhash/dff";
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
import { PanelButton } from "../../core/components/button";
import {
	PanelSection,
	PanelSectionContent,
	PanelSectionHeader,
	PanelSectionTitle,
	PanelSubSection,
	PanelSubSectionContent,
	PanelSubSectionTitle,
} from "../../core/components/panel-section";
import {
	PanelToggleGroup,
	PanelToggleGroupItem,
} from "../../core/components/toggle-group";
import type { NodeEditorProps } from "../../core/types";
import { FlexAlignmentInput } from "../inputs/flex-alignment-input";
import { TextInput } from "../inputs/text-input";

type RequiredProperties =
	| typeof gap
	| typeof justifyContent
	| typeof alignItems
	| typeof paddingTop
	| typeof paddingRight
	| typeof paddingBottom
	| typeof paddingLeft
	| typeof flexDirection;

type FlexDirection = "row" | "column";

interface LayoutSectionProps extends NodeEditorProps<RequiredProperties> {
	/** The flex direction, used to orient alignment inputs */
	direction: FlexDirection;
}

export function LayoutSection({
	node,
	onNodeChange,
	direction,
}: LayoutSectionProps) {
	const padding = {
		paddingTop: node.paddingTop,
		paddingRight: node.paddingRight,
		paddingBottom: node.paddingBottom,
		paddingLeft: node.paddingLeft,
	};

	return (
		<PanelSection>
			<PanelSectionHeader>
				<PanelSectionTitle>Layout</PanelSectionTitle>
			</PanelSectionHeader>
			<PanelSectionContent>
				{/* <LayoutFlowInput />
        <PanelSubSection>
          <PanelSubSectionTitle>Gap</PanelSubSectionTitle>
          <PanelSubSectionContent>
            <NumberInput
              min={0}
              onChange={(value) => onNodeChange({ ...node, gap: value })}
              suffix="px"
              value={node.gap}
            />
          </PanelSubSectionContent>
        </PanelSubSection>

        <PanelSubSection>
          <PanelSubSectionTitle>Main Axis</PanelSubSectionTitle>
          <PanelSubSectionContent>
            <JustifyContentInput
              direction={direction}
              onChange={(value) =>
                onNodeChange({ ...node, justifyContent: value })
              }
              value={node.justifyContent}
            />
          </PanelSubSectionContent>
        </PanelSubSection>

        <PanelSubSection>
          <PanelSubSectionTitle>Cross Axis</PanelSubSectionTitle>
          <PanelSubSectionContent>
            <AlignItemsInput
              direction={direction}
              onChange={(value) => onNodeChange({ ...node, alignItems: value })}
              value={node.alignItems}
            />
          </PanelSubSectionContent>
        </PanelSubSection> */}

				<FlexSubsection node={node} onNodeChange={onNodeChange} />
				<PaddingSubSection node={node} onNodeChange={onNodeChange} />
			</PanelSectionContent>
		</PanelSection>
	);
}

// ===============================
// Flex
// ===============================

type FlexSubsectionProps = NodeEditorProps<
	typeof justifyContent | typeof alignItems | typeof gap | typeof flexDirection
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
function shouldShowIndividualPadding(
	node: NodeEditorProps<RequiredProperties>["node"],
) {
	return (
		node.paddingTop !== node.paddingBottom ||
		node.paddingLeft !== node.paddingRight
	);
}

type PaddingSubSectionProps = NodeEditorProps<
	| typeof paddingTop
	| typeof paddingRight
	| typeof paddingBottom
	| typeof paddingLeft
>;
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
