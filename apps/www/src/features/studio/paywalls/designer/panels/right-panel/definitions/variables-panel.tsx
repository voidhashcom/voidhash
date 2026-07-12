"use client";

/**
 * Built-in panel DEFINITION for the `Variables` section — the wire-tree replica
 * of {@link ../sections/variables-section.VariablesSection} (+ its `VariableRow`
 * and `PendingVariableRow`).
 *
 * Structure (old JSX → wire nodes):
 * - `PanelSection` + header "Variables" → `Panel.Section title="Variables"`.
 * - The header type-picker (old `DropdownMenu` of Text/Number/Boolean/Product,
 *   `+` trigger) → `Panel.SectionActions` > `Panel.Menu` (its `onSelect` starts a
 *   pending variable). PARITY NOTE: the wire `menu` renders a chevron trigger, not
 *   the old `+`.
 * - Each existing variable → a `Panel.Row` with a controlled `Panel.Popover`
 *   (open when `openVariableId === id`) over a name `Panel.TextField` + a
 *   type-appropriate literal editor (string→text field, number→number field,
 *   boolean→a True/False `Panel.ToggleGroup` matching the old `BooleanInput`,
 *   product→the new `Panel.ProductField`), plus a `−` remove `Panel.Button`.
 * - A pending variable renders the same row shape with `open` gated on the 200ms
 *   timer, and NO remove-on-close (its close commits or drops).
 *
 * Buffering + commit discipline (identical to the old rows):
 * - A VariableRow buffers `editName`/`editValue` locally, re-seeded when the row
 *   opens (the old `useEffect` on `isOpen`/name/value); on close it persists ONLY
 *   if changed — name via `!==`, value via `JSON.stringify` compare — through
 *   `updateVariable` (one undo per changed field). Close-unchanged is a no-op.
 * - The pending flow seeds from `VARIABLE_TYPE_REGISTRY[type].defaultValue`; a
 *   200ms `setTimeout` (replicated here, cleaned up on unmount) opens the popover
 *   (the old Radix focus-trap timing). On close: trim name; empty → silent drop;
 *   `>32` chars → `toastError` (same message); duplicate → `toastError`; else
 *   `addVariable({name, nodeId, nodeType, type})`.
 *
 * PARITY GAP: the pending row's 50ms name autofocus lived in the old row's popover
 * ref; the wire `popoverContent` exposes no input ref/autofocus seam, so the
 * autofocus is dropped (functional editing is unaffected).
 */
import type { VariableType, VariableTypeKey } from "@voidhash/mimic-schema";
import type { PanelContext } from "@voidhash/paywalls/panel";
import { Panel } from "@voidhash/paywalls/panel";
import { useCallback, useEffect, useState } from "react";

import { VARIABLE_TYPE_REGISTRY } from "../../../constants";
import { usePanelHostServices } from "../../../panel-runtime/panel-host-services";
import { addVariable, removeVariable, updateVariable } from "../../../state/actions";
import { usePaywallDesignerActions } from "../../../state/designer-store";
import type { StatefulEditableNodeType } from "../../../state/actions/node-resolver";
import { useDefinitionNodes } from "./use-definition-nodes";

/** A decoded local variable: its array-entry id + the `{ name, value }` variable. */
interface LocalVariable {
  readonly id: string;
  readonly value: { readonly name: string; readonly value: VariableType };
}

/** A pending (not-yet-added) variable being authored. */
interface PendingVariable {
  readonly type: VariableTypeKey;
  readonly name: string;
  readonly value: VariableType;
}

/** Unwraps `node.data.localVariables` (`{id,value}` envelope) into decoded variables. */
function readLocalVariables(node: unknown): LocalVariable[] {
  const raw = (node as { data?: { localVariables?: readonly unknown[] } }).data?.localVariables;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const e = entry as { id?: string; value?: { name?: string; value?: VariableType } };
    if (e.value === undefined || typeof e.id !== "string") return [];
    return [
      { id: e.id, value: { name: e.value.name ?? "", value: e.value.value as VariableType } },
    ];
  });
}

/** The value-display string shown on a row's trigger (mirrors the old rows). */
function valueDisplay(value: VariableType): string {
  switch (value.key) {
    case "string":
      return value.value || '""';
    case "number":
      return String(value.value);
    case "boolean":
      return value.value ? "True" : "False";
    case "product":
      return value.value.productId ? "…" : "None";
  }
}

/** The `Variables` panel definition. */
export function VariablesPanel(_ctx: PanelContext) {
  const dispatch = usePaywallDesignerActions();
  const services = usePanelHostServices();
  const { nodes } = useDefinitionNodes();

  const node = nodes[0];
  const nodeId = node?.id ?? "";
  const nodeType = (node?.type ?? "view") as StatefulEditableNodeType;
  const variables = node ? readLocalVariables(node) : [];
  const existingNames = new Set(variables.map((v) => v.value.name));

  const [openVariableId, setOpenVariableId] = useState<string | null>(null);
  // The open row's buffered edits (re-seeded on open); persisted only on close.
  const [editName, setEditName] = useState("");
  const [editValue, setEditValue] = useState<VariableType>({ key: "string", value: "" });

  const [pendingVariable, setPendingVariable] = useState<PendingVariable | null>(null);
  const [isPendingPopoverOpen, setIsPendingPopoverOpen] = useState(false);

  // Open the pending popover after 200ms (the old Radix focus-trap timing);
  // cleanup clears the timer on unmount / when the pending state resets.
  useEffect(() => {
    if (pendingVariable && !isPendingPopoverOpen) {
      const timer = setTimeout(() => setIsPendingPopoverOpen(true), 200);
      return () => clearTimeout(timer);
    }
    if (!pendingVariable) setIsPendingPopoverOpen(false);
  }, [pendingVariable, isPendingPopoverOpen]);

  const startAdding = useCallback((type: VariableTypeKey) => {
    setPendingVariable({ type, name: "", value: VARIABLE_TYPE_REGISTRY[type].defaultValue });
    setIsPendingPopoverOpen(false);
    setOpenVariableId(null);
  }, []);

  const openRow = useCallback(
    (variable: LocalVariable, open: boolean) => {
      if (open) {
        setPendingVariable(null);
        setEditName(variable.value.name);
        setEditValue(variable.value.value);
        setOpenVariableId(variable.id);
      } else {
        // Persist buffered edits on close, only if changed (mirrors the old row).
        if (editName !== variable.value.name) {
          dispatch(updateVariable)({ newName: editName, nodeId, nodeType, variableId: variable.id });
        }
        if (JSON.stringify(editValue) !== JSON.stringify(variable.value.value)) {
          dispatch(updateVariable)({
            newValue: editValue,
            nodeId,
            nodeType,
            variableId: variable.id,
          });
        }
        setOpenVariableId(null);
      }
    },
    [dispatch, editName, editValue, nodeId, nodeType],
  );

  const commitPending = useCallback(
    (open: boolean) => {
      if (open || !isPendingPopoverOpen || !pendingVariable) return;
      const trimmedName = pendingVariable.name.trim();
      setPendingVariable(null);
      if (!trimmedName) return;
      if (trimmedName.length > 32) {
        services.toastError("Variable name must be less than 32 characters");
        return;
      }
      if (existingNames.has(trimmedName)) {
        services.toastError("A variable with this name already exists");
        return;
      }
      dispatch(addVariable)({ name: trimmedName, nodeId, nodeType, type: pendingVariable.type });
    },
    [dispatch, existingNames, isPendingPopoverOpen, nodeId, nodeType, pendingVariable, services],
  );

  if (!node) return null;

  const hasBody = variables.length > 0 || pendingVariable !== null;

  return (
    <Panel>
      <Panel.Section title="Variables">
        <Panel.SectionActions>
          <Panel.Menu
            items={[
              { value: "string", label: "Text" },
              { value: "number", label: "Number" },
              { value: "boolean", label: "Boolean (True / False)" },
              { value: "product", label: "Product" },
            ]}
            onSelect={(value) => startAdding(value as VariableTypeKey)}
          />
        </Panel.SectionActions>
        {hasBody && (
          <Panel.Column gap="sm">
            {variables.map((variable) => (
              <VariableRow
                key={variable.id}
                editName={openVariableId === variable.id ? editName : variable.value.name}
                editValue={openVariableId === variable.id ? editValue : variable.value.value}
                isOpen={openVariableId === variable.id}
                name={variable.value.name}
                onEditName={setEditName}
                onEditValue={setEditValue}
                onOpenChange={(open) => openRow(variable, open)}
                onRemove={() =>
                  dispatch(removeVariable)({ nodeId, nodeType, variableId: variable.id })
                }
                value={variable.value.value}
              />
            ))}
            {pendingVariable && (
              <VariableRow
                editName={pendingVariable.name}
                editValue={pendingVariable.value}
                isOpen={isPendingPopoverOpen}
                name={pendingVariable.name}
                onEditName={(name) =>
                  setPendingVariable((prev) => (prev ? { ...prev, name } : null))
                }
                onEditValue={(value) =>
                  setPendingVariable((prev) => (prev ? { ...prev, value } : null))
                }
                onOpenChange={commitPending}
                onRemove={() => setPendingVariable(null)}
                value={pendingVariable.value}
              />
            )}
          </Panel.Column>
        )}
      </Panel.Section>
    </Panel>
  );
}

/** One variable row: a controlled popover trigger + name/value editors + remove. */
function VariableRow({
  name,
  value,
  editName,
  editValue,
  isOpen,
  onEditName,
  onEditValue,
  onOpenChange,
  onRemove,
}: {
  name: string;
  value: VariableType;
  editName: string;
  editValue: VariableType;
  isOpen: boolean;
  onEditName: (name: string) => void;
  onEditValue: (value: VariableType) => void;
  onOpenChange: (open: boolean) => void;
  onRemove: () => void;
}) {
  return (
    <Panel.Row align="center">
      <Panel.Popover open={isOpen} onOpenChange={onOpenChange}>
        <Panel.PopoverTrigger>
          {/* No `variant` → the host defaults to the `secondary` trigger look. */}
          <Panel.Button label={`${name || "Unnamed"}  ${valueDisplay(value)}`} size="sm" />
        </Panel.PopoverTrigger>
        <Panel.PopoverContent align="start" side="left">
          <Panel.Field label="Name">
            <Panel.TextField
              kind="text"
              placeholder="Variable name"
              value={editName}
              onChange={onEditName}
            />
          </Panel.Field>
          <Panel.Field label="Value">
            <VariableValueEditor value={editValue} onChange={onEditValue} />
          </Panel.Field>
        </Panel.PopoverContent>
      </Panel.Popover>
      <Panel.Button icon="minus" size="icon-sm" onClick={onRemove} />
    </Panel.Row>
  );
}

/** The type-appropriate literal editor for a variable's value. */
function VariableValueEditor({
  value,
  onChange,
}: {
  value: VariableType;
  onChange: (value: VariableType) => void;
}) {
  switch (value.key) {
    case "string":
      return (
        <Panel.TextField
          kind="text"
          value={value.value}
          onChange={(next) => onChange({ key: "string", value: next })}
        />
      );
    case "number":
      return (
        <Panel.TextField
          kind="number"
          value={value.value}
          onChange={(next) => onChange({ key: "number", value: Number(next) || 0 })}
        />
      );
    case "boolean":
      return (
        <Panel.ToggleGroup
          options={[
            { value: "true", label: "True" },
            { value: "false", label: "False" },
          ]}
          value={value.value ? "true" : "false"}
          onChange={(next) => onChange({ key: "boolean", value: next === "true" })}
        />
      );
    case "product":
      return (
        <Panel.ProductField
          productId={value.value.productId ?? undefined}
          placeholder="Select product…"
          onChange={(productId) =>
            onChange({ key: "product", value: productId ? { productId } : {} })
          }
        />
      );
  }
}
