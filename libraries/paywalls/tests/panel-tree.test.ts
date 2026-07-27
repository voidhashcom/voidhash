import { describe, expect, test } from "vitest";

import { PANEL_CAPS, PANEL_NODE_SPECS, PANEL_TREE_VERSION } from "../src/schema/panel-tree";
import { parsePanelTree } from "../src/schema/validate-panel";

/**
 * A running id counter so every fixture node gets a unique id without the
 * fixtures having to hand-thread integers. Reset per builder call.
 */
let nextId = 0;
const id = () => nextId++;

/**
 * A fully-populated valid panel tree containing EVERY node type in the v1
 * vocabulary, with a realistic prop/event population per type. This doubles as
 * the host-contract fixture, so it stays exhaustive.
 */
const fullTree = () => {
  nextId = 0;
  return {
    version: PANEL_TREE_VERSION,
    root: {
      type: "panel",
      id: id(),
      props: {},
      events: [],
      children: [
        {
          type: "section",
          id: id(),
          props: { title: "Layout", collapsible: true, defaultCollapsed: false },
          events: ["onToggle"],
          children: [
            {
              type: "sectionActions",
              id: id(),
              props: {},
              events: [],
              children: [
                {
                  type: "button",
                  id: id(),
                  props: { icon: "plus", variant: "ghost", size: "icon-sm" },
                  events: ["onClick"],
                },
              ],
            },
            {
              type: "subsection",
              id: id(),
              props: { title: "Size" },
              events: [],
              children: [
                {
                  type: "row",
                  id: id(),
                  props: { gap: "sm", width: "full", align: "center", justify: "between" },
                  events: [],
                  children: [
                    {
                      type: "column",
                      id: id(),
                      props: { gap: "xs", width: "auto", align: "start" },
                      events: [],
                      children: [
                        {
                          type: "field",
                          id: id(),
                          props: { label: "Width", icon: "w" },
                          events: [],
                          children: [
                            {
                              type: "dimensionField",
                              id: id(),
                              props: {
                                axis: "width",
                                mode: "custom",
                                value: 240,
                                label: "Width",
                                mixed: false,
                                disabled: false,
                                computed: 240,
                              },
                              events: ["onChange", "onCommit", "onModeChange"],
                            },
                          ],
                        },
                        {
                          type: "field",
                          id: id(),
                          props: { label: "Align", icon: "a" },
                          events: [],
                          children: [
                            {
                              type: "alignmentGrid",
                              id: id(),
                              props: {
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                mixed: false,
                              },
                              events: ["onChange"],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "section",
          id: id(),
          props: { title: "Content", collapsible: true },
          events: ["onToggle"],
          children: [
            {
              type: "text",
              id: id(),
              props: { content: "Edit the paywall.", variant: "muted", tone: "neutral" },
              events: [],
            },
            {
              type: "callout",
              id: id(),
              props: { message: "Product is unset.", tone: "warning" },
              events: [],
            },
            {
              type: "textField",
              id: id(),
              props: {
                kind: "number",
                value: 16,
                mixed: false,
                placeholder: "size",
                min: 0,
                max: 200,
                step: 1,
                icon: "type",
                disabled: false,
                trailingMenu: {
                  items: [
                    { value: "auto", label: "Auto" },
                    { value: "fixed", label: "Fixed" },
                  ],
                  value: "auto",
                },
              },
              events: ["onChange", "onCommit", "onTrailingSelect"],
            },
            {
              type: "selectField",
              id: id(),
              props: {
                value: "cover",
                options: [
                  { value: "cover", label: "Cover", icon: "image" },
                  { value: "contain", label: "Contain", disabled: false },
                ],
                placeholder: "mode",
                mixed: false,
                disabled: false,
              },
              events: ["onChange"],
            },
            {
              type: "toggleGroup",
              id: id(),
              props: {
                value: "left",
                options: [
                  { value: "left", icon: "arrowRight" },
                  { value: "center", label: "Center" },
                ],
                mixed: false,
                disabled: false,
              },
              events: ["onChange"],
            },
            {
              type: "switchField",
              id: id(),
              props: { checked: true, mixed: false, label: "Visible", disabled: false },
              events: ["onChange"],
            },
            {
              type: "sliderField",
              id: id(),
              props: { value: 50, min: 0, max: 100, step: 1, mixed: false, disabled: false },
              events: ["onChange", "onCommit"],
            },
            {
              type: "resetAffordance",
              id: id(),
              props: { show: true, label: "Reset" },
              events: ["onReset"],
              children: [
                {
                  type: "text",
                  id: id(),
                  props: { content: "overridden" },
                  events: [],
                },
              ],
            },
          ],
        },
        {
          type: "section",
          id: id(),
          props: { title: "Fill" },
          events: [],
          children: [
            {
              type: "field",
              id: id(),
              props: { label: "Fill" },
              events: [],
              children: [
                {
                  type: "swatch",
                  id: id(),
                  props: { color: "rgba(0,0,0,1)", imageUrl: null },
                  events: [],
                },
                {
                  type: "fillField",
                  id: id(),
                  props: {
                    label: "Fill",
                    backgroundType: "gradient",
                    isTypeMixed: false,
                    backgroundColor: "rgba(0,0,0,1)",
                    gradient: {
                      kind: "linear",
                      startX: 0,
                      startY: 0,
                      endX: 1,
                      endY: 1,
                      stops: [
                        { color: "rgba(0,0,0,1)", position: 0 },
                        { color: "rgba(255,255,255,1)", position: 1 },
                      ],
                    },
                    selectedStopIndex: 0,
                    image: { url: "", resizeMode: "cover" },
                    open: false,
                  },
                  events: [
                    "onTypeChange",
                    "onColorChange",
                    "onGradientChange",
                    "onAddStopAt",
                    "onSelectStop",
                    "onCommit",
                    "onDiscard",
                    "onOpenChange",
                  ],
                },
              ],
            },
            {
              type: "popover",
              id: id(),
              props: { open: false },
              events: ["onOpenChange"],
              children: [
                {
                  type: "popoverTrigger",
                  id: id(),
                  props: {},
                  events: [],
                  children: [
                    {
                      type: "button",
                      id: id(),
                      props: { label: "Edit fill", icon: "paintbrush", variant: "outline" },
                      events: ["onClick"],
                    },
                  ],
                },
                {
                  type: "popoverContent",
                  id: id(),
                  props: { align: "start", side: "bottom" },
                  events: [],
                  children: [
                    {
                      type: "colorField",
                      id: id(),
                      props: { value: "rgba(0,0,0,1)", mixed: false, disabled: false },
                      events: ["onChange", "onDragStart", "onCommit", "onDiscard"],
                    },
                    {
                      type: "colorPicker",
                      id: id(),
                      props: { color: "000000", opacity: 100 },
                      events: [
                        "onColorChange",
                        "onOpacityChange",
                        "onDragStart",
                        "onDragEnd",
                        "onDiscard",
                      ],
                    },
                    {
                      type: "gradientStops",
                      id: id(),
                      props: {
                        stops: [
                          { id: 0, position: 0, color: "rgba(0,0,0,1)" },
                          { id: 1, position: 1, color: "rgba(255,255,255,1)" },
                        ],
                        selectedStopId: 0,
                      },
                      events: [
                        "onSelect",
                        "onAddStop",
                        "onMoveStop",
                        "onRemoveStop",
                        "onDragStart",
                        "onDragEnd",
                      ],
                    },
                    {
                      type: "imageField",
                      id: id(),
                      props: { url: "", resizeMode: "cover" },
                      events: ["onPick", "onResizeModeChange", "onClear"],
                    },
                  ],
                },
              ],
            },
            {
              type: "menu",
              id: id(),
              props: {
                items: [
                  { value: "solid", label: "Solid" },
                  { value: "gradient", label: "Gradient", disabled: false },
                ],
                value: "solid",
                align: "end",
              },
              events: ["onSelect"],
            },
          ],
        },
        {
          type: "section",
          id: id(),
          props: { title: "Binding" },
          events: [],
          children: [
            {
              type: "variableField",
              id: id(),
              props: {
                variableId: "var_1",
                variableName: "isPro",
                variableType: "boolean",
                allowedKinds: ["boolean"],
                label: "Visible when",
              },
              events: ["onBind", "onUnbind", "onCreate"],
            },
            {
              type: "actionEditorField",
              id: id(),
              props: {
                value: {
                  type: "set-variable",
                  payload: {
                    variableId: "var_1",
                    newValue: { type: "literal", value: { key: "boolean", value: true } },
                  },
                },
                variables: [
                  { id: "var_1", name: "isPro", value: { key: "boolean", value: true } },
                ],
                productVariables: [
                  {
                    id: "var_2",
                    name: "plan",
                    ownerLabel: "Root",
                    aliasId: "alias_2",
                    value: { key: "product", value: { productId: "prod_1" } },
                  },
                ],
                payloadFields: ["productId"],
              },
              events: ["onChange"],
            },
            {
              type: "productField",
              id: id(),
              props: {
                productId: "prod_1",
                placeholder: "Select product…",
                disabled: false,
                label: "Product",
              },
              events: ["onChange"],
            },
          ],
        },
        {
          type: "section",
          id: id(),
          props: { title: "Component" },
          events: [],
          children: [
            {
              type: "propField",
              id: id(),
              props: { name: "heading" },
              events: [],
            },
            {
              type: "defaultProps",
              id: id(),
              props: { exclude: ["heading", "product"] },
              events: [],
            },
          ],
        },
      ],
    },
  };
};

describe("parsePanelTree — valid contract fixture", () => {
  test("a fully-populated tree with every node type parses ok", () => {
    const result = parsePanelTree(fullTree());
    expect(result).toEqual({ ok: true, tree: fullTree() });
  });

  test("the fixture exercises every node type in the vocabulary", () => {
    const seen = new Set<string>();
    const walk = (node: { type: string; children?: unknown[] }) => {
      seen.add(node.type);
      for (const child of node.children ?? []) {
        walk(child as { type: string; children?: unknown[] });
      }
    };
    walk(fullTree().root);
    for (const type of Object.keys(PANEL_NODE_SPECS)) {
      expect(seen.has(type), `fixture is missing node type "${type}"`).toBe(true);
    }
  });

  test("accepts a serialized JSON string", () => {
    const result = parsePanelTree(JSON.stringify(fullTree()));
    expect(result.ok).toBe(true);
  });
});

describe("parsePanelTree — rejections", () => {
  test("rejects an unknown node type", () => {
    const tree = fullTree();
    (tree.root.children[0] as { type: string }).type = "mysteryNode";
    const result = parsePanelTree(tree);
    expect(result.ok).toBe(false);
  });

  test("rejects an unknown prop key", () => {
    const tree = fullTree();
    (tree.root.children[0] as { props: Record<string, unknown> }).props.bogus = 1;
    const result = parsePanelTree(tree);
    expect(result.ok).toBe(false);
  });

  test("rejects an event name not in the type's allowlist", () => {
    const tree = fullTree();
    (tree.root.children[0] as { events: string[] }).events = ["onToggle", "onHack"];
    const result = parsePanelTree(tree);
    expect(result.ok).toBe(false);
  });

  test("rejects duplicate ids", () => {
    const tree = fullTree();
    (tree.root.children[0] as { id: number }).id = tree.root.id;
    const result = parsePanelTree(tree);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/duplicated/);
  });

  test("rejects a negative id", () => {
    const tree = fullTree();
    (tree.root.children[0] as { id: number }).id = -1;
    expect(parsePanelTree(tree).ok).toBe(false);
  });

  test("rejects a non-integer id", () => {
    const tree = fullTree();
    (tree.root.children[0] as { id: number }).id = 1.5;
    expect(parsePanelTree(tree).ok).toBe(false);
  });

  test("rejects children on a childless type", () => {
    const tree = {
      version: PANEL_TREE_VERSION,
      root: {
        type: "panel",
        id: 0,
        props: {},
        events: [],
        children: [
          { type: "text", id: 1, props: { content: "x" }, events: [], children: [] },
        ],
      },
    };
    const result = parsePanelTree(tree);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/does not allow children/);
  });

  test("rejects a root that is not a panel", () => {
    const tree = { version: PANEL_TREE_VERSION, root: { type: "section", id: 0, props: {}, events: [], children: [] } };
    const result = parsePanelTree(tree);
    expect(result.ok).toBe(false);
  });

  test("rejects a version mismatch", () => {
    const tree = fullTree();
    (tree as { version: number }).version = 999;
    const result = parsePanelTree(tree);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/version/);
  });

  test("rejects an unknown icon token", () => {
    const tree = {
      version: PANEL_TREE_VERSION,
      root: {
        type: "panel",
        id: 0,
        props: {},
        events: [],
        children: [{ type: "button", id: 1, props: { icon: "skull" }, events: ["onClick"] }],
      },
    };
    const result = parsePanelTree(tree);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/icon token/);
  });

  test("rejects a top-level envelope key that is not version/root", () => {
    const tree = { ...fullTree(), extra: 1 };
    expect(parsePanelTree(tree).ok).toBe(false);
  });

  test("rejects malformed JSON strings", () => {
    expect(parsePanelTree("{ not json").ok).toBe(false);
  });
});

describe("parsePanelTree — caps", () => {
  test("rejects a tree exceeding the node cap", () => {
    const children = Array.from({ length: PANEL_CAPS.nodes + 1 }, (_, i) => ({
      type: "text",
      id: i + 1,
      props: {},
      events: [],
    }));
    const tree = { version: PANEL_TREE_VERSION, root: { type: "panel", id: 0, props: {}, events: [], children } };
    const result = parsePanelTree(tree);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/nodes/);
  });

  test("rejects a tree exceeding the depth cap", () => {
    let nodeId = 0;
    const buildNested = (remaining: number): Record<string, unknown> => ({
      type: "column",
      id: nodeId++,
      props: {},
      events: [],
      children: remaining > 0 ? [buildNested(remaining - 1)] : [],
    });
    const root = {
      type: "panel",
      id: nodeId++,
      props: {},
      events: [],
      children: [buildNested(PANEL_CAPS.depth + 2)],
    };
    const result = parsePanelTree({ version: PANEL_TREE_VERSION, root });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/depth/);
  });

  test("rejects a string value exceeding the string cap", () => {
    const tree = {
      version: PANEL_TREE_VERSION,
      root: {
        type: "panel",
        id: 0,
        props: {},
        events: [],
        children: [
          { type: "text", id: 1, props: { content: "x".repeat(PANEL_CAPS.stringLength + 1) }, events: [] },
        ],
      },
    };
    const result = parsePanelTree(tree);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/chars/);
  });

  test("rejects options exceeding the options cap", () => {
    const options = Array.from({ length: PANEL_CAPS.options + 1 }, (_, i) => ({
      value: `o${i}`,
      label: `Option ${i}`,
    }));
    const tree = {
      version: PANEL_TREE_VERSION,
      root: {
        type: "panel",
        id: 0,
        props: {},
        events: [],
        children: [
          { type: "selectField", id: 1, props: { value: "o0", options }, events: ["onChange"] },
        ],
      },
    };
    const result = parsePanelTree(tree);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/options/);
  });

  test("rejects gradient stops exceeding the stops cap", () => {
    const stops = Array.from({ length: PANEL_CAPS.gradientStops + 1 }, (_, i) => ({
      id: i,
      position: i / (PANEL_CAPS.gradientStops + 1),
      color: "rgba(0,0,0,1)",
    }));
    const tree = {
      version: PANEL_TREE_VERSION,
      root: {
        type: "panel",
        id: 0,
        props: {},
        events: [],
        children: [
          { type: "gradientStops", id: 1, props: { stops, selectedStopId: 0 }, events: ["onSelect"] },
        ],
      },
    };
    const result = parsePanelTree(tree);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/gradient stops/);
  });

  test("rejects a node exceeding the events-per-node cap", () => {
    const events = Array.from({ length: PANEL_CAPS.eventsPerNode + 1 }, (_, i) => `e${i}`);
    const tree = {
      version: PANEL_TREE_VERSION,
      root: {
        type: "panel",
        id: 0,
        props: {},
        events: [],
        children: [{ type: "fillField", id: 1, props: {}, events }],
      },
    };
    const result = parsePanelTree(tree);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/events/);
  });

  test("rejects a serialized string exceeding the byte cap", () => {
    const huge = `{"padding":"${"a".repeat(PANEL_CAPS.treeBytes + 10)}"}`;
    const result = parsePanelTree(huge);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/bytes/);
  });
});

describe("PANEL_CAPS", () => {
  test("has the contract-mandated values", () => {
    expect(PANEL_CAPS).toEqual({
      treeBytes: 262144,
      nodes: 2000,
      depth: 32,
      stringLength: 4096,
      options: 256,
      gradientStops: 64,
      eventsPerNode: 8,
      intentBytes: 32768,
    });
  });
});
