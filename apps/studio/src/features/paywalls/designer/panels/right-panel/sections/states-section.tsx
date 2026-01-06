"use client";

import type {
	DNF,
	FlexNodeData,
	ScreenNodeData,
	TextNodeData,
} from "@voidhash/mimic-schema";
import { cn } from "@voidhash/ui";
import { SettingsIcon } from "lucide-react";
import { useState } from "react";

import { PanelButton } from "@/features/paywalls/designer/components/ui/button";
import {
	PanelSection,
	PanelSectionContent,
	PanelSectionHeader,
	PanelSectionHeaderActions,
	PanelSectionTitle,
} from "@/features/paywalls/designer/components/ui/panel-section";

import { StateManagerSheet } from "@/features/paywalls/designer/components/state-manager";

type NodeWithStates = FlexNodeData | ScreenNodeData | TextNodeData;

export interface StatesSectionProps {
	node: NodeWithStates;
	onAddState: (nodeId: string, name: string, condition: DNF) => void;
	onRemoveState: (nodeId: string, stateId: string) => void;
	onUpdateState: (
		nodeId: string,
		stateId: string,
		updates: {
			newName?: string;
			newCondition?: DNF;
		},
	) => void;
}

export const StatesSection = ({
	node,
	onAddState,
	onRemoveState,
	onUpdateState,
}: StatesSectionProps) => {
	const states = node.states ?? [];
	const variables = node.localVariables ?? [];
	const [isSheetOpen, setIsSheetOpen] = useState(false);

	const handleAddState = (name: string, condition: DNF) => {
		onAddState(node.id, name, condition);
	};

	const handleRemoveState = (stateId: string) => {
		onRemoveState(node.id, stateId);
	};

	const handleUpdateStateName = (stateId: string, newName: string) => {
		onUpdateState(node.id, stateId, { newName });
	};

	const handleUpdateStateCondition = (stateId: string, newCondition: DNF) => {
		onUpdateState(node.id, stateId, { newCondition });
	};

	return (
		<PanelSection>
			<PanelSectionHeader>
				<PanelSectionTitle>States</PanelSectionTitle>
				<PanelSectionHeaderActions>
					<PanelButton
						icon={<SettingsIcon />}
						onClick={() => setIsSheetOpen(true)}
						size="icon"
						variant="ghost"
					/>
				</PanelSectionHeaderActions>
			</PanelSectionHeader>
			<PanelSectionContent>
				<div className="flex flex-col">
					<div
						className={cn(
							"flex h-7 items-center rounded-sm px-2 font-medium text-xs",
							"bg-accent text-accent-foreground",
							states.length > 0 && "rounded-b-none",
						)}
					>
						Default
					</div>
					{states.map((state, index) => (
						<div
							className={cn(
								"flex h-7 items-center rounded-sm px-2 font-medium text-muted-foreground text-xs",
								index === 0 && "rounded-t-none",
							)}
							key={state.id}
						>
							{state.value.name}
						</div>
					))}
				</div>
			</PanelSectionContent>
			<StateManagerSheet
				onAddState={handleAddState}
				onOpenChange={setIsSheetOpen}
				onRemoveState={handleRemoveState}
				onUpdateStateCondition={handleUpdateStateCondition}
				onUpdateStateName={handleUpdateStateName}
				open={isSheetOpen}
				states={states}
				variables={variables}
			/>
		</PanelSection>
	);
};
