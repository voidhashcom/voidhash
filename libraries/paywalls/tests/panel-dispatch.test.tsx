import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { createPanelSession, Panel, type PanelSessionInputs } from "../src/panel/index";
import type { PanelTree } from "../src/schema/panel-tree";
import { parsePanelTree } from "../src/schema/validate-panel";

const emptyInputs: PanelSessionInputs = {
  props: {},
  selection: { count: 1 },
  data: { products: [], variables: {} },
};

const findNode = (
  tree: PanelTree,
  type: string,
): { id: number; props: Record<string, unknown>; events: ReadonlyArray<string> } | undefined => {
  const walk = (node: {
    type: string;
    id: number;
    props: Record<string, unknown>;
    events: ReadonlyArray<string>;
    children?: ReadonlyArray<unknown>;
  }): ReturnType<typeof findNode> => {
    if (node.type === type) return node;
    for (const child of node.children ?? []) {
      const hit = walk(child as never);
      if (hit) return hit;
    }
    return undefined;
  };
  return walk(tree.root as never);
};

describe("panel dispatch — discrete synchronous flush", () => {
  it("reflects a handler's setState in an onTree emission before dispatchEvent returns", () => {
    const emissions: Array<{ label: unknown; revision: number }> = [];
    const session = createPanelSession({
      render: () => {
        const [n, setN] = useState(0);
        return (
          <Panel>
            <Panel.Button label={`n=${n}`} onClick={() => setN((v) => v + 1)} />
          </Panel>
        );
      },
      initialInputs: emptyInputs,
      callbacks: {
        onTree: (tree, revision) => {
          emissions.push({ label: findNode(tree, "button")!.props.label, revision });
        },
        onError: () => {},
      },
    });

    const buttonId = findNode(session.getTree(), "button")!.id;
    const emissionsBefore = emissions.length;

    // Fire the click. The setState inside must be committed AND its tree
    // emitted before this call returns — the in-process 60fps-drag guarantee.
    const ran = session.dispatchEvent(buttonId, "onClick", []);
    expect(ran).toBe(true);

    // A new emission already arrived (synchronously), showing n=1.
    expect(emissions.length).toBe(emissionsBefore + 1);
    expect(emissions[emissions.length - 1]!.label).toBe("n=1");
    // And getTree() reflects it immediately.
    expect(findNode(session.getTree(), "button")!.props.label).toBe("n=1");
    session.dispose();
  });

  it("reads the CURRENT handler, not a captured one, across re-renders", () => {
    let clicks = 0;
    const session = createPanelSession({
      render: (ctx) => (
        <Panel>
          <Panel.Button label={`c=${ctx.selection.count}`} onClick={() => (clicks += ctx.selection.count)} />
        </Panel>
      ),
      initialInputs: emptyInputs,
      callbacks: { onTree: () => {}, onError: () => {} },
    });
    const id = findNode(session.getTree(), "button")!.id;
    // Re-render with a new closure (count 5). Dispatch must use the latest one.
    session.update({ ...emptyInputs, selection: { count: 5 } });
    session.dispatchEvent(id, "onClick", []);
    expect(clicks).toBe(5);
    session.dispose();
  });

  it("drops a stale dispatch (unknown node id) without throwing", () => {
    const session = createPanelSession({
      render: () => (
        <Panel>
          <Panel.Button label="x" onClick={() => {}} />
        </Panel>
      ),
      initialInputs: emptyInputs,
      callbacks: { onTree: () => {}, onError: () => {} },
    });
    expect(session.dispatchEvent(9999, "onClick", [])).toBe(false);
    session.dispose();
  });

  it("drops a dispatch for a name that is not currently a function prop", () => {
    const session = createPanelSession({
      render: () => (
        <Panel>
          <Panel.Button label="x" onClick={() => {}} />
        </Panel>
      ),
      initialInputs: emptyInputs,
      callbacks: { onTree: () => {}, onError: () => {} },
    });
    const id = findNode(session.getTree(), "button")!.id;
    // `onToggle` is not a prop on this button.
    expect(session.dispatchEvent(id, "onToggle", [])).toBe(false);
    session.dispose();
  });

  it("drops a dispatch to a node that has unmounted", () => {
    const session = createPanelSession<Record<string, never>>({
      render: (ctx) => (
        <Panel>
          {ctx.selection.count > 0 ? <Panel.Button label="a" onClick={() => {}} /> : null}
        </Panel>
      ),
      initialInputs: emptyInputs,
      callbacks: { onTree: () => {}, onError: () => {} },
    });
    const id = findNode(session.getTree(), "button")!.id;
    session.update({ ...emptyInputs, selection: { count: 0 } });
    // The node id is stale now; dispatch is silently dropped.
    expect(session.dispatchEvent(id, "onClick", [])).toBe(false);
    session.dispose();
  });
});

describe("panel session — error boundary", () => {
  it("reports onError and emits a generic fallback callout tree", () => {
    const onError = vi.fn();
    const trees: PanelTree[] = [];
    const session = createPanelSession({
      render: () => {
        throw new Error("author secret: boom");
      },
      initialInputs: emptyInputs,
      callbacks: {
        onTree: (tree) => trees.push(tree),
        onError,
      },
    });
    expect(onError).toHaveBeenCalled();
    // The error text never enters the tree; a neutral error callout does.
    const tree = session.getTree();
    const callout = findNode(tree, "callout")!;
    expect(callout.props.tone).toBe("error");
    expect(JSON.stringify(tree)).not.toContain("author secret");
    expect(tree.root.type).toBe("panel");
    // The fallback tree must survive the strict host validator (non-negative ids).
    expect(parsePanelTree(JSON.stringify(tree)).ok).toBe(true);
    session.dispose();
  });

  it("emits a valid empty-panel tree before the first commit / for empty renders", () => {
    const session = createPanelSession({
      render: () => null,
      initialInputs: emptyInputs,
      callbacks: { onTree: () => {}, onError: () => {} },
    });
    const tree = session.getTree();
    expect(tree.root.type).toBe("panel");
    expect(parsePanelTree(JSON.stringify(tree)).ok).toBe(true);
    session.dispose();
  });
});
