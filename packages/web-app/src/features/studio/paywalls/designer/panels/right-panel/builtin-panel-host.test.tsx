// @vitest-environment jsdom

import { Panel, type PanelContext, type PanelSessionInputs } from "@voidhash/paywalls/panel";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { Effect } from "effect";
import { create } from "zustand";
import { useStore } from "zustand/react";
import { afterEach, describe, expect, test } from "vite-plus/test";

import { PanelTreeView } from "../../panel-runtime/host-renderer";
import { createInProcessTransport } from "../../panel-runtime/in-process-transport";
import {
  PaywallStoreContext,
  usePaywallDesignerStore,
  type PaywallDesignerStoreType,
} from "../../state/designer-store";

// oxlint-disable-next-line effect/noTestLifecycleHooks -- React Testing Library's DOM teardown: `cleanup` must run between renders on the shared jsdom document, and the panel/store harness is created by plain React renders outside any Effect scope, so there is no Scope for Effect.acquireRelease to close.
afterEach(() => cleanup());

const EMPTY_INPUTS: PanelSessionInputs = {
  props: {},
  selection: { count: 1 },
  data: { products: [], variables: {} },
};

interface CounterState {
  count: number;
  increment: () => void;
}

/**
 * A definition that reads the designer store via the SAME hook pattern sections
 * use — `usePaywallDesignerStore()` for the instance, `useStore(store, selector)`
 * for a slice — and renders the slice into a textField. Proves store hooks work
 * inside the reconciler root when the store context is re-provided via `wrap`.
 */
function StoreReadingDefinition(_ctx: PanelContext) {
  const store = usePaywallDesignerStore();
  const count = useStore(store as never, (state: CounterState) => state.count);
  return (
    <Panel>
      <Panel.Field label="Count">
        <Panel.TextField kind="number" value={count} placeholder="store-count" />
      </Panel.Field>
    </Panel>
  );
}

/** Walks a tree and returns the first `textField` node's `value` prop. */
const findTextFieldValue = (node: {
  type: string;
  props: Record<string, unknown>;
  children?: unknown[];
}): unknown => {
  if (node.type === "textField") return node.props.value;
  for (const child of node.children ?? []) {
    const found = findTextFieldValue(child as never);
    if (found !== undefined) return found;
  }
  return undefined;
};

const flushMicrotasks = () => act(async () => {});

describe("built-in host — store context through wrap", () => {
  test("a definition reads a zustand store via wrap and re-emits on store change", async () => {
    const store = create<CounterState>((set) => ({
      count: 10,
      increment: () => set((s) => ({ count: s.count + 1 })),
    }));

    const wrap = (children: ReactNode) => (
      <PaywallStoreContext.Provider value={store as unknown as PaywallDesignerStoreType}>
        {children}
      </PaywallStoreContext.Provider>
    );

    const transport = createInProcessTransport({
      render: StoreReadingDefinition,
      initialInputs: EMPTY_INPUTS,
      wrap,
    });

    await Effect.runPromise(
      Effect.promise(async () => {
        render(<PanelTreeView transport={transport} />);
        // The initial store value flows through the store hook into the emitted
        // tree AND into the rendered input — proving the store hooks resolve inside
        // the reconciler root via the re-provided context.
        const initial = transport.getSnapshot();
        expect(initial.status === "ready" && findTextFieldValue(initial.tree.root as never)).toBe(
          10,
        );
        expect((screen.getByLabelText("store-count") as HTMLInputElement).value).toBe("10");

        // Mutating the store re-renders the definition inside the reconciler
        // (useSyncExternalStore is renderer-agnostic) and re-emits the tree with the
        // new value (emitted via the session's coalesced microtask).
        act(() => {
          store.getState().increment();
        });
        await flushMicrotasks();

        const after = transport.getSnapshot();
        expect(after.status === "ready" && findTextFieldValue(after.tree.root as never)).toBe(11);
      }).pipe(Effect.ensuring(Effect.sync(() => transport.dispose()))),
    );
  });
});
