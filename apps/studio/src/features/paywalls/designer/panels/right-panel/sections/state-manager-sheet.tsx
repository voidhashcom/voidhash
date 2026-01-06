"use client";

import { type DNF } from "@voidhash/mimic-schema";

import { InputGroup, InputGroupInput } from "@voidhash/ui/input-group";
import { Sheet, SheetClose, SheetContent } from "@voidhash/ui/sheet";
import { MinusIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { PanelButton } from "@/features/designer/components/button";
import { Panel } from "@/features/designer/components/panel";
import {
	PanelSection,
	PanelSectionContent,
	PanelSectionHeader,
	PanelSectionHeaderActions,
	PanelSectionTitle,
	PanelSubSectionTitle,
} from "@/features/designer/components/panel-section";

import { PANEL_DIMENSIONS } from "../../constants";
import { Card, CardFooter } from "@voidhash/ui";

interface State {
	readonly id: string;
	readonly value: {
		readonly name: string;
		readonly condition: DNF;
	};
}

interface StateManagerSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	states: readonly State[];
	onAddState: (name: string, condition: DNF) => void;
	onRemoveState: (stateId: string) => void;
	onUpdateStateName: (stateId: string, newName: string) => void;
}

// Default DNF condition (always true)
const createDefaultCondition = (): DNF =>
	({
		type: "or" as const,
		value: [
			{
				type: "and" as const,
				value: [
					{
						type: "equals" as const,
						value: {
							left: {
								type: "literal" as const,
								value: { key: "boolean" as const, value: true },
							},
							right: {
								type: "literal" as const,
								value: { key: "boolean" as const, value: true },
							},
						},
					},
				],
			},
		],
	}) as unknown as DNF;

const usePendingState = ({
	existingStateNames,
	onAddState,
}: {
	existingStateNames: Set<string>;
	onAddState: (name: string, condition: DNF) => void;
}) => {
	const [pendingState, setPendingState] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const startAdding = useCallback(() => {
		setPendingState("");
		setTimeout(() => {
			inputRef.current?.focus();
		}, 50);
	}, []);

	const cancel = useCallback(() => {
		setPendingState(null);
	}, []);

	const save = useCallback(() => {
		if (pendingState === null) {
			return;
		}

		const trimmedName = pendingState.trim();

		// Silent cancellation for empty names
		if (!trimmedName) {
			setPendingState(null);
			return;
		}

		// Validate max length
		if (trimmedName.length > 32) {
			toast.error("State name must be less than 32 characters");
			setPendingState(null);
			return;
		}

		// Validate uniqueness
		if (existingStateNames.has(trimmedName)) {
			toast.error("A state with this name already exists");
			setPendingState(null);
			return;
		}

		onAddState(trimmedName, createDefaultCondition());
		setPendingState(null);
	}, [pendingState, existingStateNames, onAddState]);

	const updateName = useCallback((name: string) => {
		setPendingState(name);
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Escape") {
				cancel();
			} else if (e.key === "Enter") {
				save();
			}
		},
		[cancel, save],
	);

	return {
		cancel,
		handleKeyDown,
		inputRef,
		isPending: pendingState !== null,
		pendingState,
		save,
		startAdding,
		updateName,
	};
};

const useEditingState = ({
	existingStateNames,
	onUpdateStateName,
}: {
	existingStateNames: Set<string>;
	onUpdateStateName: (stateId: string, newName: string) => void;
}) => {
	const [editingState, setEditingState] = useState<{
		id: string;
		name: string;
		originalName: string;
	} | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const startEditing = useCallback((stateId: string, currentName: string) => {
		setEditingState({
			id: stateId,
			name: currentName,
			originalName: currentName,
		});
		setTimeout(() => {
			inputRef.current?.focus();
			inputRef.current?.select();
		}, 50);
	}, []);

	const cancel = useCallback(() => {
		setEditingState(null);
	}, []);

	const save = useCallback(() => {
		if (editingState === null) {
			return;
		}

		const trimmedName = editingState.name.trim();

		// If empty or unchanged, just cancel
		if (!trimmedName || trimmedName === editingState.originalName) {
			setEditingState(null);
			return;
		}

		// Validate max length
		if (trimmedName.length > 32) {
			toast.error("State name must be less than 32 characters");
			setEditingState(null);
			return;
		}

		// Validate uniqueness (excluding current name)
		if (
			existingStateNames.has(trimmedName) &&
			trimmedName !== editingState.originalName
		) {
			toast.error("A state with this name already exists");
			setEditingState(null);
			return;
		}

		onUpdateStateName(editingState.id, trimmedName);
		setEditingState(null);
	}, [editingState, existingStateNames, onUpdateStateName]);

	const updateName = useCallback((name: string) => {
		setEditingState((prev) => (prev ? { ...prev, name } : null));
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Escape") {
				cancel();
			} else if (e.key === "Enter") {
				save();
			}
		},
		[cancel, save],
	);

	return {
		cancel,
		editingState,
		handleKeyDown,
		inputRef,
		isEditing: (stateId: string) => editingState?.id === stateId,
		save,
		startEditing,
		updateName,
	};
};

export const StateManagerSheet = ({
	onAddState,
	onOpenChange,
	onRemoveState,
	onUpdateStateName,
	open,
	states,
}: StateManagerSheetProps) => {
	const existingStateNames = new Set(states.map((s) => s.value.name));
	const [selectedState, setSelectedState] = useState<State | null>(null);

	const {
		cancel: cancelAdding,
		handleKeyDown: handleAddKeyDown,
		inputRef: addInputRef,
		isPending,
		pendingState,
		save: saveAdd,
		startAdding,
		updateName: updateAddName,
	} = usePendingState({
		existingStateNames,
		onAddState,
	});

	const {
		editingState,
		handleKeyDown: handleEditKeyDown,
		inputRef: editInputRef,
		isEditing,
		save: saveEdit,
		startEditing,
		updateName: updateEditName,
	} = useEditingState({
		existingStateNames,
		onUpdateStateName,
	});

	return (
		<Sheet onOpenChange={onOpenChange} open={open}>
			<SheetContent
				className="flex flex-row gap-0 p-0 sm:max-w-220"
				side="right"
				hideOverlay={true}
				hideCloseButton={true}
			>
				{/* Sidebar */}
				<div
					className="flex flex-col border-border border-r bg-sidebar"
					style={{
						width: PANEL_DIMENSIONS.RIGHT_WIDTH,
					}}
				>
					<Panel>
						<PanelSection>
							<PanelSectionHeader>
								<PanelSectionTitle>States</PanelSectionTitle>
								<PanelSectionHeaderActions>
									<PanelButton
										icon={<PlusIcon />}
										onClick={startAdding}
										size="icon"
									/>
								</PanelSectionHeaderActions>
							</PanelSectionHeader>

							{(states.length > 0 || isPending) && (
								<PanelSectionContent className="border-t border-border pt-2">
									<div className="flex flex-col gap-2">
										{states.map((state) => (
											<div className="flex flex-row gap-2" key={state.id}>
												{isEditing(state.id) ? (
													<>
														<InputGroup className="h-7 flex-1 rounded-sm border-none dark:bg-input/60">
															<InputGroupInput
																aria-label="State name"
																className="h-7 px-1 py-0 pl-2 text-xs"
																onBlur={saveEdit}
																onChange={(e) => updateEditName(e.target.value)}
																onKeyDown={handleEditKeyDown}
																ref={editInputRef}
																value={editingState?.name ?? ""}
															/>
														</InputGroup>
													</>
												) : (
													<>
														<PanelButton
															type="button"
															variant="secondary"
															className="flex-1 text-left justify-start"
														>
															{state.value.name}
														</PanelButton>
														<PanelButton
															icon={<PencilIcon />}
															onClick={() =>
																startEditing(state.id, state.value.name)
															}
															size="icon"
														/>
														<PanelButton
															icon={<MinusIcon />}
															onClick={() => onRemoveState(state.id)}
															size="icon"
														/>
													</>
												)}
											</div>
										))}
										{isPending && (
											<div className="flex flex-row gap-1">
												<InputGroup className="h-7 flex-1 rounded-sm border-none dark:bg-input/60">
													<InputGroupInput
														aria-label="State name"
														className="h-7 px-1 py-0 pl-2 text-xs"
														onBlur={saveAdd}
														onChange={(e) => updateAddName(e.target.value)}
														onKeyDown={handleAddKeyDown}
														placeholder="State name..."
														ref={addInputRef}
														value={pendingState ?? ""}
													/>
												</InputGroup>
											</div>
										)}
									</div>
								</PanelSectionContent>
							)}
						</PanelSection>
					</Panel>
				</div>

				{/* State detail */}
				<div className="flex-1">
					<Panel>
						<PanelSection>
							<PanelSectionHeader>
								<PanelSectionTitle>Hover</PanelSectionTitle>
								<PanelSectionHeaderActions>
									<SheetClose asChild>
										<PanelButton icon={<XIcon />} size="icon" variant="ghost" />
									</SheetClose>
								</PanelSectionHeaderActions>
							</PanelSectionHeader>

							<PanelSectionContent className="border-t border-border pt-2">
								<div className="flex flex-col gap-2">
									<div className="flex flex-row gap-2">
										<Card className="w-full p-0">
											<PanelSectionHeader>
												<PanelSubSectionTitle>
													IF ALL OF THESE ARE TRUE
												</PanelSubSectionTitle>
												<PanelSectionHeaderActions>
													{/* Add a condition */}
													<PanelButton icon={<PlusIcon />} size="icon" />
													{/*           
                          // Only when there are multiple AND conditions.         
                          <PanelButton
                            icon={<MinusIcon />}
                            size="icon"
                            variant="ghost"
                          />
                        */}
												</PanelSectionHeaderActions>
											</PanelSectionHeader>

											{/*  DNF. There will be a list of conditions here. When none, should show an empty  */}

											{/* Footer to save or cancel the changes. This should only be shown when there are changes to the DNF. */}
											<CardFooter className="flex flex-row gap-2 p-0 justify-end px-4 py-2">
												<PanelButton size="default" variant="outline">
													Cancel
												</PanelButton>
												<PanelButton size="default">Save Changes</PanelButton>
											</CardFooter>
										</Card>
									</div>
								</div>
							</PanelSectionContent>
						</PanelSection>
					</Panel>
				</div>
			</SheetContent>
		</Sheet>
	);
};
