"use client";

/**
 * The concrete {@link PanelHostServices} implementation the built-in panel host
 * installs. It owns the portalled host chrome (the State Manager sheet, a confirm
 * AlertDialog) in the MAIN React tree — not inside the panel reconciler — and
 * hands a stable services object to the reconciler subtree via
 * {@link PanelHostServicesProvider}, wired through the built-in host's `wrap`.
 *
 * Sheets/dialogs portal to `document.body`, so they render correctly even though
 * the definitions that trigger them live in a separate reconciler root; only the
 * imperative triggers (`openStateManager`, `confirmComponentUpdate`, `toastError`)
 * cross the boundary — never React elements.
 */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@voidhash/ui";
import { Effect } from "effect";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import type {
  PathSnapshotNode,
  ScreenSnapshotNode,
  ShapeSnapshotNode,
  SnapshotNode,
  TextSnapshotNode,
  ViewSnapshotNode,
} from "@voidhash/paywall-renderer-web-core";
import { useStore } from "zustand/react";

import { StateManagerSheet } from "@/features/studio/paywalls/designer/components/state-manager";
import type {
  CRDTState,
  CRDTVariable,
} from "@/features/studio/paywalls/designer/components/state-manager/types";
import {
  addNodeState,
  removeNodeState,
  updateNodeState,
} from "@/features/studio/paywalls/designer/state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "@/features/studio/paywalls/designer/state/designer-store";
import { collectAncestorVariables } from "@/features/studio/paywalls/designer/state/utils/ancestor-variables";
import { selectDocumentRoot } from "@/features/studio/paywalls/designer/state/utils/document-root";
import { getNodeById } from "@/features/studio/paywalls/designer/state/utils/nodes";
import type { DnfInput } from "@/features/studio/paywalls/designer/state/utils/replay";

import type {
  ComponentUpdatePlan,
  PanelHostServices,
} from "../../panel-runtime/panel-host-services";

/** A node type that carries `states` (the state-override capable node types). */
type NodeWithStates =
  | ViewSnapshotNode
  | ScreenSnapshotNode
  | TextSnapshotNode
  | ShapeSnapshotNode
  | PathSnapshotNode;

/** True when the node is one of the state-override capable node types. */
function isNodeWithStates(node: SnapshotNode): node is NodeWithStates {
  return (
    node.type === "view" ||
    node.type === "screen" ||
    node.type === "text" ||
    node.type === "shape" ||
    node.type === "path"
  );
}

/**
 * Renders the host chrome and provides a stable {@link PanelHostServices} object
 * to `children` (which the built-in host threads into the reconciler via its
 * `wrap`). The State Manager sheet's data is derived from the store for whatever
 * node id is currently open, mirroring the states section's own derivation.
 */
export function PanelHostServicesHost({
  children,
}: {
  children: (services: PanelHostServices) => ReactNode;
}) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const documentRoot = useStore(store, selectDocumentRoot);

  // ── State Manager sheet ────────────────────────────────────────────────────
  const [stateManagerNodeId, setStateManagerNodeId] = useState<string | null>(null);
  const rawSheetNode = stateManagerNodeId
    ? getNodeById(store.getState(), stateManagerNodeId)
    : null;
  const sheetNode = rawSheetNode && isNodeWithStates(rawSheetNode) ? rawSheetNode : null;

  const sheetStates: readonly CRDTState[] = sheetNode
    ? sheetNode.data.states.flatMap((entry) =>
        entry.value === undefined ? [] : [{ id: entry.id, value: entry.value }],
      )
    : [];

  const sheetVariables: readonly CRDTVariable[] = sheetNode
    ? collectAncestorVariables(documentRoot, sheetNode.id).map((variable) => ({
        id: variable.id,
        ownerLabel: variable.ownerNodeId === sheetNode.id ? undefined : variable.ownerName,
        value: { name: variable.name, value: variable.value },
      }))
    : [];

  // ── Confirm dialog ──────────────────────────────────────────────────────────
  const [confirmPlan, setConfirmPlan] = useState<ComponentUpdatePlan | null>(null);
  const confirmResolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const resolveConfirm = useCallback((confirmed: boolean) => {
    confirmResolveRef.current?.(confirmed);
    confirmResolveRef.current = null;
    setConfirmPlan(null);
  }, []);

  // ── Services object (stable identity) ──────────────────────────────────────
  const services = useMemo<PanelHostServices>(
    () => ({
      openStateManager(nodeId: string) {
        setStateManagerNodeId(nodeId);
      },
      confirmComponentUpdate(plan: ComponentUpdatePlan) {
        return Effect.runPromise(
          Effect.callback<boolean>((resume) => {
            confirmResolveRef.current = (confirmed) => resume(Effect.succeed(confirmed));
            setConfirmPlan(plan);
          }),
        );
      },
      toastError(message: string) {
        toast.error(message);
      },
    }),
    [],
  );

  return (
    <>
      {children(services)}

      <StateManagerSheet
        onAddState={(name: string, condition: DnfInput) => {
          if (sheetNode) {
            dispatch(addNodeState)({
              condition,
              name,
              nodeId: sheetNode.id,
              nodeType: sheetNode.type,
            });
          }
        }}
        onOpenChange={(open) => {
          if (!open) setStateManagerNodeId(null);
        }}
        onRemoveState={(stateId: string) => {
          if (sheetNode) {
            dispatch(removeNodeState)({ nodeId: sheetNode.id, nodeType: sheetNode.type, stateId });
          }
        }}
        onUpdateStateCondition={(stateId: string, newCondition: DnfInput) => {
          if (sheetNode) {
            dispatch(updateNodeState)({
              newCondition,
              nodeId: sheetNode.id,
              nodeType: sheetNode.type,
              stateId,
            });
          }
        }}
        onUpdateStateName={(stateId: string, newName: string) => {
          if (sheetNode) {
            dispatch(updateNodeState)({
              newName,
              nodeId: sheetNode.id,
              nodeType: sheetNode.type,
              stateId,
            });
          }
        }}
        open={stateManagerNodeId !== null}
        states={sheetStates}
        variables={sheetVariables}
      />

      <AlertDialog onOpenChange={(open) => !open && resolveConfirm(false)} open={confirmPlan !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmPlan?.title ?? ""}</AlertDialogTitle>
            {confirmPlan?.details && confirmPlan.details.length > 0 && (
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  {confirmPlan.details.map((line) => (
                    <p className="text-sm" key={line}>
                      {line}
                    </p>
                  ))}
                </div>
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => resolveConfirm(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => resolveConfirm(true)}>
              {confirmPlan?.confirmLabel ?? "Update"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
