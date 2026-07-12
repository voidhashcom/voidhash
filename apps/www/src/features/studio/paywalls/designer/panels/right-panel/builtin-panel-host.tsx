"use client";

/**
 * Mounts ONE in-process built-in panel session for a section and renders its
 * tree with the host kit. The session is keyed by `sectionId` ONLY (by the
 * PanelStack's `key={section.id}`), so a selection change NEVER remounts it —
 * the definition's `useState` survives across selections exactly like today's
 * `key={section.id}` sections (inventory §A / anomaly 4). Selection and nodes
 * flow into the definition as INPUTS via `transport.update`, not as a remount.
 *
 * `wrap` re-wraps providers INSIDE the reconciler root: the SAME designer zustand
 * store (via {@link PaywallStoreContext}, so `useStore`-based section hooks work
 * unchanged inside the reconciler) plus the {@link PanelHostServicesProvider}
 * host-services surface. The portalled host chrome (State Manager sheet, confirm
 * dialog) lives in the main tree inside {@link PanelHostServicesHost}.
 */
import type { PanelContext, PanelSessionInputs } from "@voidhash/paywalls/panel";
import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";

import { PanelTreeView } from "../../panel-runtime/host-renderer";
import type { PanelRender, PanelWrap } from "../../panel-runtime/in-process-transport";
import {
  PanelHostServicesProvider,
  type PanelHostServices,
} from "../../panel-runtime/panel-host-services";
import { usePanelSession, type BuiltinPanelSource } from "../../panel-runtime/use-panel-session";
import {
  PaywallStoreContext,
  usePaywallDesignerStore,
  type PaywallDesignerStoreType,
} from "../../state/designer-store";
import {
  createDefinitionSelectionStore,
  DefinitionSelectionProvider,
  type DefinitionSelectionStore,
} from "./definitions/definition-selection";
import { PanelHostServicesHost } from "./panel-host-services-host";

/** The selection snapshot fed to a built-in definition as inputs. */
export interface BuiltinPanelSelection {
  /** The selected node ids the panel edits (the definition resolves data from the store). */
  readonly nodeIds: readonly string[];
}

export interface BuiltinPanelHostProps {
  /** The section this host renders (used only for diagnostics; identity is the mount key). */
  readonly sectionId: string;
  /** The built-in panel definition to run in-process. */
  readonly definition: PanelRender;
  /** The current selection (flows to the definition via `update`, never remounts). */
  readonly selection: BuiltinPanelSelection;
}

/**
 * Builds the {@link PanelSessionInputs} for a built-in definition. Built-in
 * panels are trusted and read node data straight from the store (via `wrap`), so
 * the wire inputs carry only the selection COUNT; the selected node IDS reach the
 * definition over the non-serializable {@link DefinitionSelectionProvider} seam
 * (they never cross the sandbox boundary). `props` and `data` are empty
 * (definitions don't use the sandbox prop channel).
 */
const buildInputs = (selection: BuiltinPanelSelection): PanelSessionInputs => ({
  props: {},
  selection: { count: selection.nodeIds.length },
  data: { products: [], variables: {} },
});

/**
 * The inner session view — separated so it can consume the host services yielded
 * by {@link PanelHostServicesHost} and call {@link usePanelSession} at the top
 * level. Builds a `wrap` that re-provides the store + host services inside the
 * reconciler root.
 */
function BuiltinPanelSessionView({
  definition,
  selection,
  store,
  services,
}: {
  definition: PanelRender;
  selection: BuiltinPanelSelection;
  store: PaywallDesignerStoreType;
  services: PanelHostServices;
}): ReactNode {
  // The selection store is the reactive channel that carries the SELECTED NODE
  // IDS to the definition (the wire inputs only carry `selection.count`). Created
  // once (stable identity, so it never remounts the session) and updated on every
  // selection change; the definition subscribes to it via `useDefinitionSelection`.
  const selectionStoreRef = useRef<DefinitionSelectionStore | null>(null);
  selectionStoreRef.current ??= createDefinitionSelectionStore(selection.nodeIds);
  const selectionStore = selectionStoreRef.current;
  useEffect(() => {
    selectionStore.setNodeIds(selection.nodeIds);
  }, [selectionStore, selection]);

  // The wrap re-provides the store context (so `useStore(store, …)` hooks resolve
  // inside the reconciler), the host services, and the selection store. Memoized
  // on store+services+selectionStore — all stable across selection changes — so
  // its identity never changes and a new `wrap` never remounts the session.
  const wrap = useMemo<PanelWrap>(
    () => (children: ReactNode) => (
      <PaywallStoreContext.Provider value={store}>
        <PanelHostServicesProvider value={services}>
          <DefinitionSelectionProvider value={selectionStore}>
            {children}
          </DefinitionSelectionProvider>
        </PanelHostServicesProvider>
      </PaywallStoreContext.Provider>
    ),
    [store, services, selectionStore],
  );

  // The source identity is keyed on the definition + wrap only (NOT selection),
  // so pushing a new selection updates inputs without recreating the transport.
  const source = useMemo<BuiltinPanelSource>(
    () => ({ kind: "builtin", render: definition, wrap }),
    [definition, wrap],
  );

  const inputs = useMemo(() => buildInputs(selection), [selection]);
  const transport = usePanelSession(source, inputs);

  return <PanelTreeView transport={transport} />;
}

/**
 * Mounts a built-in panel host for `sectionId`. Renders the portalled host
 * chrome via {@link PanelHostServicesHost} and, inside it, the session view. The
 * PanelStack keys this component by `sectionId` so it persists across selections.
 */
export function BuiltinPanelHost({ definition, selection }: BuiltinPanelHostProps): ReactNode {
  const store = usePaywallDesignerStore();
  return (
    <PanelHostServicesHost>
      {(services) => (
        <BuiltinPanelSessionView
          definition={definition}
          selection={selection}
          services={services}
          store={store}
        />
      )}
    </PanelHostServicesHost>
  );
}
