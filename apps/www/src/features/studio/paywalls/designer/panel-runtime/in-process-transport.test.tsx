// @vitest-environment jsdom

import { Panel, type PanelContext, type PanelSessionInputs } from "@voidhash/paywalls/panel";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Effect } from "effect";
import { afterEach, describe, expect, test } from "vite-plus/test";

import { PanelTreeView } from "./host-renderer";
import { createInProcessTransport } from "./in-process-transport";

afterEach(() => cleanup());

const EMPTY_INPUTS: PanelSessionInputs = {
  props: {},
  selection: { count: 1 },
  data: { products: [], variables: {} },
};

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

/**
 * A tiny built-in definition: a local `useState` counter shown in a read-only
 * textField, with a button that increments it. The click flows through the
 * session's synchronous dispatch and re-renders the tree with the new count.
 */
function CounterDefinition(_ctx: PanelContext) {
  const [count, setCount] = useState(0);
  return (
    <Panel>
      <Panel.Field label="Count">
        <Panel.TextField kind="number" value={count} placeholder="count" />
      </Panel.Field>
      <Panel.Button label="Increment" onClick={() => setCount((c) => c + 1)} />
    </Panel>
  );
}

describe("in-process transport — round trip", () => {
  test("click → dispatch → a NEW tree renders synchronously", () => {
    const transport = createInProcessTransport({
      render: CounterDefinition,
      initialInputs: EMPTY_INPUTS,
    });

    Effect.runSync(
      Effect.sync(() => {
        // The first tree is emitted synchronously during construction.
        const initial = transport.getSnapshot();
        expect(initial.status).toBe("ready");

        render(<PanelTreeView transport={transport} />);
        // The count textField shows 0 initially.
        expect((screen.getByLabelText("count") as HTMLInputElement).value).toBe("0");

        // Click the button: the OSS session flushes setState + re-emits the tree
        // synchronously before dispatchEvent returns, so the new value is present.
        fireEvent.click(screen.getByText("Increment"));
        expect((screen.getByLabelText("count") as HTMLInputElement).value).toBe("1");

        fireEvent.click(screen.getByText("Increment"));
        expect((screen.getByLabelText("count") as HTMLInputElement).value).toBe("2");

        // The snapshot revision advanced (each dispatch emitted a new tree).
        const after = transport.getSnapshot();
        expect(after.status).toBe("ready");
        if (after.status === "ready") {
          expect(after.revision).toBeGreaterThan(0);
        }
      }).pipe(Effect.ensuring(Effect.sync(() => transport.dispose()))),
    );
  });

  test("the dev-assert path accepts a valid built-in emission", () => {
    // import.meta.env.DEV is true under the test runner, so this exercises the
    // decodePanelTreeDev assertion on every emission — a valid definition passes.
    const transport = createInProcessTransport({
      render: CounterDefinition,
      initialInputs: EMPTY_INPUTS,
    });
    Effect.runSync(
      Effect.sync(() => {
        expect(transport.getSnapshot().status).toBe("ready");
      }).pipe(Effect.ensuring(Effect.sync(() => transport.dispose()))),
    );
  });

  test("restart tears down and remounts a fresh session with a reset tree", () => {
    const transport = createInProcessTransport({
      render: CounterDefinition,
      initialInputs: EMPTY_INPUTS,
    });
    Effect.runSync(
      Effect.sync(() => {
        render(<PanelTreeView transport={transport} />);
        fireEvent.click(screen.getByText("Increment"));
        fireEvent.click(screen.getByText("Increment"));

        // The live tree carries the incremented count.
        const before = transport.getSnapshot();
        expect(before.status).toBe("ready");
        const beforeValue =
          before.status === "ready"
            ? findTextFieldValue(before.tree.root as never)
            : undefined;
        expect(beforeValue).toBe(2);

        // Restart mounts a fresh session: the emitted tree's count resets to 0.
        transport.restart();
        const after = transport.getSnapshot();
        expect(after.status).toBe("ready");
        const afterValue =
          after.status === "ready" ? findTextFieldValue(after.tree.root as never) : undefined;
        expect(afterValue).toBe(0);
      }).pipe(Effect.ensuring(Effect.sync(() => transport.dispose()))),
    );
  });
});
