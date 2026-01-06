"use client";

import { cn, useConfirmDialog } from "@voidhash/ui";
import { InputGroup, InputGroupInput } from "@voidhash/ui/input-group";
import { Sheet, SheetClose, SheetContent } from "@voidhash/ui/sheet";
import {
	MinusIcon,
	PencilIcon,
	PlusIcon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PANEL_DIMENSIONS } from "../../panels/constants";
import { PanelButton } from "../ui/button";
import { Panel } from "../ui/panel";
import {
	PanelSection,
	PanelSectionContent,
	PanelSectionHeader,
	PanelSectionHeaderActions,
	PanelSectionTitle,
} from "../ui/panel-section";
import { DNFEditor } from "./dnf-editor";
import { useEditingState } from "./use-editing-state";
import { useDNFEditor } from "./use-dnf-editor";
import { usePendingState } from "./use-pending-state";
import type { StateManagerSheetProps } from "./types";

/**
 * StateManagerSheet - A slide-out sheet for managing paywall states.
 *
 * Features:
 * - Left sidebar with list of states (add, edit name, remove)
 * - Right panel with DNF condition editor for selected state
 * - Save/cancel footer when changes are pending
 */
export function StateManagerSheet({
	onAddState,
	onOpenChange,
	onRemoveState,
	onUpdateStateCondition,
	onUpdateStateName,
	open,
	states,
	variables,
}: StateManagerSheetProps) {
	const existingStateNames = new Set(states.map((s) => s.value.name));
	const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
	const { openDialog, ConfirmationDialog } = useConfirmDialog();

	// Find selected state
	const selectedState = useMemo(
		() => states.find((s) => s.id === selectedStateId) ?? null,
		[states, selectedStateId],
	);

	// DNF editor hook
	const {
		addConjunction,
		addPredicate,
		cancel: cancelDNFEditing,
		editingDNF,
		getDNFForSave,
		hasChanges,
		removeConjunction,
		removePredicate,
		reset: resetDNFEditor,
		startEditing: startDNFEditing,
		updatePredicate,
	} = useDNFEditor();

	// Pending state hook (for adding new states)
	const {
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

	// Editing state hook (for editing state names)
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

	// Handle state selection
	const handleSelectState = useCallback(
		(stateId: string) => {
			// Don't change selection while editing name
			if (editingState) {
				return;
			}

			if (selectedStateId === stateId) {
				return;
			}

			// If there are unsaved changes, prompt user
			if (hasChanges) {
				const confirmed = window.confirm(
					"You have unsaved changes. Discard them?",
				);
				if (!confirmed) {
					return;
				}
			}

			setSelectedStateId(stateId);
			const state = states.find((s) => s.id === stateId);
			if (state) {
				startDNFEditing(state.value.condition);
			}
		},
		[selectedStateId, hasChanges, states, startDNFEditing, editingState],
	);

	// Handle delete with confirmation
	const handleDeleteState = useCallback(
		async (stateId: string, stateName: string) => {
			const confirmed = await openDialog({
				title: "Delete state",
				description: `Are you sure you want to delete the state "${stateName}"? This action cannot be undone.`,
				confirmText: "Delete",
				variant: "destructive",
			});

			if (confirmed) {
				onRemoveState(stateId);
			}
		},
		[openDialog, onRemoveState],
	);

	// Handle save
	const handleSave = useCallback(() => {
		if (!selectedStateId) {
			return;
		}
		const dnf = getDNFForSave();
		if (!dnf) {
			return;
		}

		onUpdateStateCondition(selectedStateId, dnf);
		// Re-sync with saved state
		const state = states.find((s) => s.id === selectedStateId);
		if (state) {
			startDNFEditing(state.value.condition);
		}
	}, [
		selectedStateId,
		getDNFForSave,
		onUpdateStateCondition,
		states,
		startDNFEditing,
	]);

	// Auto-select first state when sheet opens
	useEffect(() => {
		if (open && states.length > 0 && !selectedStateId) {
			const firstState = states[0];
			if (firstState) {
				setSelectedStateId(firstState.id);
				startDNFEditing(firstState.value.condition);
			}
		}
	}, [open, states, selectedStateId, startDNFEditing]);

	// Reset when sheet closes
	useEffect(() => {
		if (!open) {
			setSelectedStateId(null);
			resetDNFEditor();
		}
	}, [open, resetDNFEditor]);

	// Update DNF editor when selected state's condition changes externally
	useEffect(() => {
		if (selectedState && !hasChanges) {
			startDNFEditing(selectedState.value.condition);
		}
	}, [
		selectedState?.value.condition,
		hasChanges,
		startDNFEditing,
		selectedState,
	]);

	return (
		<>
			<ConfirmationDialog />
			<Sheet onOpenChange={onOpenChange} open={open}>
				<SheetContent
					className="flex flex-row gap-0 p-0 sm:max-w-220"
					hideCloseButton={true}
					hideOverlay={true}
					side="right"
				>
					{/* Sidebar - State list */}
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
									<PanelSectionContent className="border-border border-t pt-2">
										<div className="flex flex-col gap-2">
											{states.map((state) => (
												<div className="flex flex-row gap-2" key={state.id}>
													<PanelButton
														className={cn(
															"flex-1 justify-start rounded-l-0 border-l-2 text-left",
															selectedStateId === state.id
																? "border-l-primary"
																: "border-l-transparent",
														)}
														variant="secondary"
														onClick={() => handleSelectState(state.id)}
														type="button"
													>
														{state.value.name}
													</PanelButton>
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

					{/* Detail panel - DNF editor */}
					<div className="flex flex-1 flex-col">
						<Panel className="flex-1">
							<PanelSection>
								<PanelSectionHeader>
									<PanelSectionTitle>
										{selectedState && isEditing(selectedState.id) ? (
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
										) : (
											<div className="flex flex-row gap-1 items-center">
												<span className="mr-4">
													{selectedState?.value.name ?? "Select a state"}
												</span>
												{selectedState && !isEditing(selectedState.id) && (
													<>
														<PanelButton
															icon={<PencilIcon />}
															onClick={() =>
																startEditing(
																	selectedState.id,
																	selectedState.value.name,
																)
															}
															size="icon"
														/>
														<PanelButton
															icon={<Trash2Icon />}
															onClick={() =>
																handleDeleteState(
																	selectedState.id,
																	selectedState.value.name,
																)
															}
															size="icon"
														/>
													</>
												)}
											</div>
										)}
									</PanelSectionTitle>
									<PanelSectionHeaderActions>
										{hasChanges ? (
											<>
												<PanelButton
													onClick={cancelDNFEditing}
													variant="outline"
												>
													Cancel
												</PanelButton>
												<PanelButton onClick={handleSave}>
													Save Changes
												</PanelButton>
											</>
										) : (
											<SheetClose asChild>
												<PanelButton
													icon={<XIcon />}
													size="icon"
													variant="ghost"
												/>
											</SheetClose>
										)}
									</PanelSectionHeaderActions>
								</PanelSectionHeader>

								{selectedState && editingDNF ? (
									<PanelSectionContent className="border-border border-t pt-2">
										<DNFEditor
											dnf={editingDNF}
											onAddConjunction={addConjunction}
											onAddPredicate={addPredicate}
											onRemoveConjunction={removeConjunction}
											onRemovePredicate={removePredicate}
											onUpdatePredicate={updatePredicate}
											variables={variables}
										/>
									</PanelSectionContent>
								) : (
									<PanelSectionContent className="border-border border-t pt-2">
										<div className="py-8 text-center text-muted-foreground text-sm">
											{states.length === 0
												? "No states yet. Create one to get started."
												: "Select a state from the list to edit its conditions."}
										</div>
									</PanelSectionContent>
								)}
							</PanelSection>
						</Panel>
					</div>
				</SheetContent>
			</Sheet>
		</>
	);
}
