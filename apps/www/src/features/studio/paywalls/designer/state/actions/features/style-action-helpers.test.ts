import { describe, expect, test } from "vite-plus/test";

import { applyStyleUpdate, type StyleTarget, undoStyleUpdate } from "./style-action-helpers";

type MockStateEntry = {
  id: string;
  pos: string;
  value: {
    id: string;
    name: string;
    condition: Record<string, unknown>;
    overrides: {
      style: Record<string, unknown>;
      actions: Array<{
        id: string;
        pos: string;
        value: { interactionId: string; action: { type: string } };
      }>;
    };
  };
};

type MockNode = {
  id: string;
  type: "view";
  data: {
    style: Record<string, unknown>;
    states: MockStateEntry[];
  };
  children: unknown[];
};

function createMockNode(id: string, baseColor: string, overrideColor: string): MockNode {
  return {
    id,
    type: "view",
    data: {
      style: {
        alignSelf: "auto",
        backgroundColor: baseColor,
        height: 100,
        width: 100,
      },
      states: [
        {
          id: "state-1",
          pos: "a0",
          value: {
            condition: {
              type: "or",
              value: [
                {
                  type: "and",
                  value: [
                    {
                      type: "equals",
                      value: {
                        left: {
                          type: "literal",
                          value: { key: "boolean", value: true },
                        },
                        right: {
                          type: "literal",
                          value: { key: "boolean", value: true },
                        },
                      },
                    },
                  ],
                },
              ],
            },
            id: `state-value-${id}`,
            name: "Hovered",
            overrides: {
              actions: [],
              style: {
                backgroundColor: overrideColor,
              },
            },
          },
        },
      ],
    },
    children: [],
  };
}

function createMockMimic(nodes: MockNode[]) {
  const snapshot = [
    {
      children: nodes,
      data: { name: "Root" },
      id: "root",
      type: "root",
    },
  ];

  const makeStateProxy = (stateEntry: MockStateEntry) => ({
    overrides: {
      style: {
        set: (value: Record<string, unknown>) => {
          stateEntry.value.overrides.style = { ...value };
        },
        update: (value: Record<string, unknown>) => {
          const next = { ...stateEntry.value.overrides.style };
          for (const [key, item] of Object.entries(value)) {
            if (item === undefined) {
              delete next[key];
              continue;
            }
            next[key] = item;
          }
          stateEntry.value.overrides.style = next;
        },
      },
    },
  });

  const makeNodeProxy = (node: MockNode) => ({
    data: {
      states: {
        findById: (stateId: string) => {
          const state = node.data.states.find((entry) => entry.id === stateId);
          if (!state) {
            return undefined;
          }
          return { value: makeStateProxy(state) };
        },
      },
    },
    update: (value: { style?: Record<string, unknown> }) => {
      if (value.style) {
        const next = { ...node.data.style };
        for (const [key, item] of Object.entries(value.style)) {
          if (item === undefined) {
            delete next[key];
            continue;
          }
          next[key] = item;
        }
        node.data.style = next;
      }
    },
  });

  const transactionRoot = {
    findByIdAcrossTree: (id: string) => {
      const node = nodes.find((entry) => entry.id === id);
      if (!node) {
        return undefined;
      }
      const proxy = makeNodeProxy(node);
      return {
        as: () => proxy,
        type: node.type,
      };
    },
  };

  const mimic = {
    document: {
      transaction: (fn: (root: typeof transactionRoot) => void) => {
        fn(transactionRoot);
      },
    },
    snapshot,
  };

  return {
    mimic,
    getNode: (id: string) => nodes.find((node) => node.id === id),
    getStateOverrideValue: (nodeId: string, key: string) =>
      nodes.find((node) => node.id === nodeId)?.data.states[0]?.value.overrides.style[key] ?? null,
  };
}

describe("applyStyleUpdate", () => {
  const targets: StyleTarget[] = [{ nodeId: "node-1", nodeType: "view" }];

  test("writes style changes to selected state overrides", () => {
    const { mimic, getNode, getStateOverrideValue } = createMockMimic([
      createMockNode("node-1", "rgba(255, 0, 0, 1)", "rgba(0, 0, 255, 1)"),
    ]);

    const previous = applyStyleUpdate(
      mimic as never,
      targets,
      { backgroundColor: "rgba(0, 255, 0, 1)" },
      { "node-1": "state-1" },
      mimic.document.transaction as never,
    );

    expect(getNode("node-1")?.data.style["backgroundColor"]).toBe("rgba(255, 0, 0, 1)");
    expect(getStateOverrideValue("node-1", "backgroundColor")).toBe("rgba(0, 255, 0, 1)");

    undoStyleUpdate(mimic as never, targets, previous, mimic.document.transaction as never);
    expect(getStateOverrideValue("node-1", "backgroundColor")).toBe("rgba(0, 0, 255, 1)");
  });

  test("removes selected state override when value matches base style", () => {
    const { mimic, getNode, getStateOverrideValue } = createMockMimic([
      createMockNode("node-1", "rgba(255, 0, 0, 1)", "rgba(0, 0, 255, 1)"),
    ]);

    applyStyleUpdate(
      mimic as never,
      targets,
      { backgroundColor: getNode("node-1")?.data.style["backgroundColor"] },
      { "node-1": "state-1" },
      mimic.document.transaction as never,
    );

    expect(getStateOverrideValue("node-1", "backgroundColor")).toBeNull();
  });

  test("removes selected state override when base value is undefined", () => {
    const node = createMockNode("node-1", "rgba(255, 0, 0, 1)", "rgba(0, 0, 255, 1)");
    node.data.states[0]!.value.overrides.style["lineHeight"] = 24;

    const { mimic, getStateOverrideValue } = createMockMimic([node]);

    applyStyleUpdate(
      mimic as never,
      targets,
      { lineHeight: undefined },
      { "node-1": "state-1" },
      mimic.document.transaction as never,
    );

    expect(getStateOverrideValue("node-1", "lineHeight")).toBeNull();
  });

  test("writes style changes to base style when default is selected", () => {
    const { mimic, getNode, getStateOverrideValue } = createMockMimic([
      createMockNode("node-1", "rgba(255, 0, 0, 1)", "rgba(0, 0, 255, 1)"),
    ]);

    const previous = applyStyleUpdate(
      mimic as never,
      targets,
      { backgroundColor: "rgba(0, 255, 0, 1)" },
      {},
      mimic.document.transaction as never,
    );

    expect(getNode("node-1")?.data.style["backgroundColor"]).toBe("rgba(0, 255, 0, 1)");
    expect(getStateOverrideValue("node-1", "backgroundColor")).toBe("rgba(0, 0, 255, 1)");

    undoStyleUpdate(mimic as never, targets, previous, mimic.document.transaction as never);
    expect(getNode("node-1")?.data.style["backgroundColor"]).toBe("rgba(255, 0, 0, 1)");
  });

  test("writes multi-select updates to each node's selected state", () => {
    const { mimic, getNode, getStateOverrideValue } = createMockMimic([
      createMockNode("node-1", "rgba(255, 0, 0, 1)", "rgba(0, 0, 255, 1)"),
      createMockNode("node-2", "rgba(255, 255, 0, 1)", "rgba(255, 0, 255, 1)"),
    ]);
    const multiTargets: StyleTarget[] = [
      { nodeId: "node-1", nodeType: "view" },
      { nodeId: "node-2", nodeType: "view" },
    ];

    applyStyleUpdate(
      mimic as never,
      multiTargets,
      { backgroundColor: "rgba(0, 255, 0, 1)" },
      { "node-1": "state-1", "node-2": "state-1" },
      mimic.document.transaction as never,
    );

    expect(getNode("node-1")?.data.style["backgroundColor"]).toBe("rgba(255, 0, 0, 1)");
    expect(getNode("node-2")?.data.style["backgroundColor"]).toBe("rgba(255, 255, 0, 1)");
    expect(getStateOverrideValue("node-1", "backgroundColor")).toBe("rgba(0, 255, 0, 1)");
    expect(getStateOverrideValue("node-2", "backgroundColor")).toBe("rgba(0, 255, 0, 1)");
  });

  test("maps a null width/height clear to the literal 'auto' (hug), not deletion", () => {
    const { mimic, getNode } = createMockMimic([
      createMockNode("node-1", "rgba(255, 0, 0, 1)", "rgba(0, 0, 255, 1)"),
    ]);

    const previous = applyStyleUpdate(
      mimic as never,
      targets,
      { height: null, width: null },
      {},
      mimic.document.transaction as never,
    );

    expect(getNode("node-1")?.data.style["width"]).toBe("auto");
    expect(getNode("node-1")?.data.style["height"]).toBe("auto");

    undoStyleUpdate(mimic as never, targets, previous, mimic.document.transaction as never);
    expect(getNode("node-1")?.data.style["width"]).toBe(100);
    expect(getNode("node-1")?.data.style["height"]).toBe(100);
  });

  test("maps a null clear for other fields to field deletion", () => {
    const node = createMockNode("node-1", "rgba(255, 0, 0, 1)", "rgba(0, 0, 255, 1)");
    node.data.style["flex"] = 1;
    const { mimic, getNode } = createMockMimic([node]);

    applyStyleUpdate(
      mimic as never,
      targets,
      { flex: null },
      {},
      mimic.document.transaction as never,
    );

    expect("flex" in (getNode("node-1")?.data.style ?? {})).toBe(false);
  });

  test("writes a null width clear into the selected state override as 'auto'", () => {
    const { mimic, getNode, getStateOverrideValue } = createMockMimic([
      createMockNode("node-1", "rgba(255, 0, 0, 1)", "rgba(0, 0, 255, 1)"),
    ]);

    applyStyleUpdate(
      mimic as never,
      targets,
      { width: null },
      { "node-1": "state-1" },
      mimic.document.transaction as never,
    );

    expect(getNode("node-1")?.data.style["width"]).toBe(100);
    expect(getStateOverrideValue("node-1", "width")).toBe("auto");
  });

  const gradient = {
    kind: "linear" as const,
    startX: 0,
    startY: 0,
    endX: 1,
    endY: 1,
    stops: [
      { color: "rgba(255, 0, 0, 1)", position: 0 },
      { color: "rgba(0, 0, 255, 1)", position: 1 },
    ],
  };

  test("writes a structured gradient value to the base style", () => {
    const { mimic, getNode } = createMockMimic([
      createMockNode("node-1", "rgba(255, 0, 0, 1)", "rgba(0, 0, 255, 1)"),
    ]);

    applyStyleUpdate(
      mimic as never,
      targets,
      { backgroundType: "gradient", backgroundGradient: gradient },
      {},
      mimic.document.transaction as never,
    );

    expect(getNode("node-1")?.data.style["backgroundType"]).toBe("gradient");
    expect(getNode("node-1")?.data.style["backgroundGradient"]).toEqual(gradient);
  });

  test("writes a structured gradient value to the selected state override", () => {
    const { mimic, getNode, getStateOverrideValue } = createMockMimic([
      createMockNode("node-1", "rgba(255, 0, 0, 1)", "rgba(0, 0, 255, 1)"),
    ]);

    applyStyleUpdate(
      mimic as never,
      targets,
      { backgroundGradient: gradient },
      { "node-1": "state-1" },
      mimic.document.transaction as never,
    );

    expect(getNode("node-1")?.data.style["backgroundGradient"]).toBeUndefined();
    expect(getStateOverrideValue("node-1", "backgroundGradient")).toEqual(gradient);
  });

  test("skips a structured write when the value is deeply unchanged", () => {
    const node = createMockNode("node-1", "rgba(255, 0, 0, 1)", "rgba(0, 0, 255, 1)");
    node.data.style["backgroundGradient"] = structuredClone(gradient);
    const { mimic } = createMockMimic([node]);

    const previous = applyStyleUpdate(
      mimic as never,
      targets,
      { backgroundGradient: structuredClone(gradient) },
      {},
      mimic.document.transaction as never,
    );

    expect(previous.has("node-1")).toBe(false);
  });

  test("writes multi-select updates using each node's effective style target", () => {
    const { mimic, getNode, getStateOverrideValue } = createMockMimic([
      createMockNode("node-1", "rgba(255, 0, 0, 1)", "rgba(0, 0, 255, 1)"),
      createMockNode("node-2", "rgba(255, 255, 0, 1)", "rgba(255, 0, 255, 1)"),
    ]);
    const multiTargets: StyleTarget[] = [
      { nodeId: "node-1", nodeType: "view" },
      { nodeId: "node-2", nodeType: "view" },
    ];

    const previous = applyStyleUpdate(
      mimic as never,
      multiTargets,
      { backgroundColor: "rgba(0, 0, 255, 1)" },
      { "node-1": "state-1", "node-2": "state-1" },
      mimic.document.transaction as never,
    );

    expect(previous.has("node-1")).toBe(false);
    expect(previous.has("node-2")).toBe(true);

    expect(getStateOverrideValue("node-1", "backgroundColor")).toBe("rgba(0, 0, 255, 1)");
    expect(getStateOverrideValue("node-2", "backgroundColor")).toBe("rgba(0, 0, 255, 1)");
    expect(getNode("node-1")?.data.style["backgroundColor"]).toBe("rgba(255, 0, 0, 1)");
    expect(getNode("node-2")?.data.style["backgroundColor"]).toBe("rgba(255, 255, 0, 1)");
  });
});
