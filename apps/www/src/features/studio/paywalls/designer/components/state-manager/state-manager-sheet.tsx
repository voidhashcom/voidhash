"use client";

import { Button, cn, useConfirmDialog } from "@voidhash/ui";
import { InputGroup, InputGroupInput } from "@voidhash/ui/input-group";
import { Sheet, SheetClose, SheetContent } from "@voidhash/ui/sheet";
import { PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PANEL_DIMENSIONS } from "../../panels/constants";
import { Panel } from "../ui/panel";
import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionHeaderActions,
  PanelSectionTitle,
} from "../ui/panel-section";
import { DNFEditor } from "./dnf-editor";
import type { StateManagerSheetProps } from "./types";
import { useDNFEditor } from "./use-dnf-editor";
import { useEditingState } from "./use-editing-state";
import { usePendingState } from "./use-pending-state";

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
        const confirmed = window.confirm("You have unsaved changes. Discard them?");
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
        confirmText: "Delete",
        description: `Are you sure you want to delete the state "${stateName}"? This action cannot be undone.`,
        title: "Delete state",
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
  }, [selectedStateId, getDNFForSave, onUpdateStateCondition, states, startDNFEditing]);

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
  }, [selectedState?.value.condition, hasChanges, startDNFEditing, selectedState]);

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
                    <Button onClick={startAdding} size="icon-sm" variant="secondary">
                      <PlusIcon />
                    </Button>
                  </PanelSectionHeaderActions>
                </PanelSectionHeader>

                {(states.length > 0 || isPending) && (
                  <PanelSectionContent className="border-border border-t pt-2">
                    <div className="flex flex-col">
                      {states.map((state, index) => (
                        <button
                          className={cn(
                            "flex h-7 w-full cursor-pointer items-center rounded-sm px-2 text-left font-medium text-muted-foreground text-xs transition-all hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                            selectedStateId === state.id &&
                              "bg-accent text-accent-foreground hover:bg-accent",
                            selectedStateId === state.id &&
                              index < states.length - 1 &&
                              "rounded-b-none",
                            selectedStateId === states[index - 1]?.id && "rounded-t-none",
                          )}
                          key={state.id}
                          onClick={() => handleSelectState(state.id)}
                          type="button"
                        >
                          {state.value.name}
                        </button>
                      ))}
                      {isPending && (
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
                      <div className="flex flex-row items-center gap-1">
                        <span className="mr-4">
                          {selectedState?.value.name ?? "Select a state"}
                        </span>
                        {selectedState && !isEditing(selectedState.id) && (
                          <>
                            <Button
                              onClick={() =>
                                startEditing(selectedState.id, selectedState.value.name)
                              }
                              size="icon-sm"
                              variant="secondary"
                            >
                              <PencilIcon />
                            </Button>
                            <Button
                              onClick={() =>
                                handleDeleteState(selectedState.id, selectedState.value.name)
                              }
                              size="icon-sm"
                              variant="secondary"
                            >
                              <Trash2Icon />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </PanelSectionTitle>
                  <PanelSectionHeaderActions>
                    {hasChanges ? (
                      <>
                        <Button size="sm" onClick={cancelDNFEditing} variant="outline">
                          Cancel
                        </Button>
                        <Button size="sm" variant="default" onClick={handleSave}>
                          Save Changes
                        </Button>
                      </>
                    ) : (
                      <SheetClose asChild>
                        <Button size="icon-sm" variant="ghost">
                          <XIcon />
                        </Button>
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
