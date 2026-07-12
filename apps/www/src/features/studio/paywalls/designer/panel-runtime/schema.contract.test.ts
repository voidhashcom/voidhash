import {
  PANEL_CAPS,
  PANEL_NODE_SPECS,
  PANEL_TREE_VERSION,
  parsePanelTree,
} from "@voidhash/paywalls/schema";
import { describe, expect, test } from "vite-plus/test";

import { decodePanelIntent, decodePanelTree } from "./schema";

/**
 * A running id counter so every fixture node gets a unique id without hand-
 * threading integers. Reset per {@link fullTree} call.
 */
let nextId = 0;
const id = () => nextId++;

/**
 * A fully-populated valid panel tree containing EVERY node type in the v1
 * vocabulary, with a realistic prop/event population per type. Adapted from the
 * OSS `panel-tree.test.ts` host-contract fixture, so it stays exhaustive and
 * both validators must accept it.
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
                      props: { label: "Edit fill", icon: "paintbrush", variant: "secondary" },
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

/**
 * Deep-clones a fixture so a mutating test can never leak into the shared
 * builder output (the fixtures are plain JSON).
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Both validators must AGREE on accept/reject for a structural fixture. */
const expectAgree = (label: string, tree: unknown): void => {
  const oss = parsePanelTree(tree);
  const host = decodePanelTree(tree);
  expect(host.ok, `${label}: host=${host.ok} oss=${oss.ok}`).toBe(oss.ok);
};

/**
 * Host is a strict superset of OSS: OSS must reject, host must ALSO reject (a
 * pure structural equality). Used for every structural violation both catch.
 */
const expectBothReject = (label: string, tree: unknown): void => {
  expect(parsePanelTree(tree).ok, `${label}: OSS should reject`).toBe(false);
  expect(decodePanelTree(tree).ok, `${label}: host should reject`).toBe(false);
};

/**
 * The allowed asymmetry: OSS (structural) ACCEPTS a value-level violation the
 * host (value-typed) rejects. Asserts the host is strictly stronger here.
 */
const expectHostStricter = (label: string, tree: unknown): void => {
  expect(parsePanelTree(tree).ok, `${label}: OSS should accept (structural)`).toBe(true);
  expect(decodePanelTree(tree).ok, `${label}: host should reject (value-level)`).toBe(false);
};

describe("panel schema contract — valid fixture", () => {
  test("host accepts the fully-populated every-node-type fixture", () => {
    expect(decodePanelTree(fullTree()).ok).toBe(true);
  });

  test("OSS and host agree the fixture is valid", () => {
    expectAgree("full fixture", fullTree());
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

  test("host accepts a serialized JSON string of the fixture", () => {
    expect(decodePanelTree(JSON.stringify(fullTree())).ok).toBe(true);
  });

  test("the superset invariant holds: everything host accepts, OSS accepts", () => {
    const host = decodePanelTree(fullTree());
    const oss = parsePanelTree(fullTree());
    expect(host.ok).toBe(true);
    expect(oss.ok).toBe(true);
  });
});

describe("panel schema contract — structural rejections (both agree)", () => {
  test("unknown node type", () => {
    const tree = clone(fullTree());
    (tree.root.children[0] as { type: string }).type = "mysteryNode";
    expectBothReject("unknown type", tree);
  });

  test("unknown prop key", () => {
    const tree = clone(fullTree());
    (tree.root.children[0] as { props: Record<string, unknown> }).props.bogus = 1;
    expectBothReject("unknown prop key", tree);
  });

  test("event name outside the type's allowlist", () => {
    const tree = clone(fullTree());
    (tree.root.children[0] as { events: string[] }).events = ["onToggle", "onHack"];
    expectBothReject("disallowed event", tree);
  });

  test("duplicate ids across the tree", () => {
    const tree = clone(fullTree());
    (tree.root.children[0] as { id: number }).id = tree.root.id;
    expectBothReject("dup ids", tree);
  });

  test("negative id", () => {
    const tree = clone(fullTree());
    (tree.root.children[0] as { id: number }).id = -1;
    expectBothReject("negative id", tree);
  });

  test("non-integer id", () => {
    const tree = clone(fullTree());
    (tree.root.children[0] as { id: number }).id = 1.5;
    expectBothReject("non-integer id", tree);
  });

  test("children on a childless type", () => {
    const tree = {
      version: PANEL_TREE_VERSION,
      root: {
        type: "panel",
        id: 0,
        props: {},
        events: [],
        children: [{ type: "text", id: 1, props: { content: "x" }, events: [], children: [] }],
      },
    };
    expectBothReject("children on childless", tree);
  });

  test("root that is not a panel", () => {
    const tree = {
      version: PANEL_TREE_VERSION,
      root: { type: "section", id: 0, props: {}, events: [], children: [] },
    };
    expectBothReject("non-panel root", tree);
  });

  test("version mismatch", () => {
    const tree = clone(fullTree());
    (tree as { version: number }).version = 999;
    expectBothReject("version mismatch", tree);
  });

  test("unknown icon token", () => {
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
    expectBothReject("unknown icon", tree);
  });

  test("top-level envelope key other than version/root", () => {
    const tree = { ...fullTree(), extra: 1 };
    expectBothReject("extra envelope key", tree);
  });

  test("malformed JSON string", () => {
    expect(parsePanelTree("{ not json").ok).toBe(false);
    expect(decodePanelTree("{ not json").ok).toBe(false);
  });

  test("non-object tree", () => {
    expectBothReject("non-object tree", 42);
  });
});

describe("panel schema contract — caps (both agree)", () => {
  test("node count cap", () => {
    const children = Array.from({ length: PANEL_CAPS.nodes + 1 }, (_, i) => ({
      type: "text",
      id: i + 1,
      props: {},
      events: [],
    }));
    const tree = {
      version: PANEL_TREE_VERSION,
      root: { type: "panel", id: 0, props: {}, events: [], children },
    };
    expectBothReject("node cap", tree);
  });

  test("depth cap", () => {
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
    expectBothReject("depth cap", { version: PANEL_TREE_VERSION, root });
  });

  test("string length cap", () => {
    const tree = {
      version: PANEL_TREE_VERSION,
      root: {
        type: "panel",
        id: 0,
        props: {},
        events: [],
        children: [
          {
            type: "text",
            id: 1,
            props: { content: "x".repeat(PANEL_CAPS.stringLength + 1) },
            events: [],
          },
        ],
      },
    };
    expectBothReject("string cap", tree);
  });

  test("options cap", () => {
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
    expectBothReject("options cap", tree);
  });

  test("gradient stops cap", () => {
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
          {
            type: "gradientStops",
            id: 1,
            props: { stops, selectedStopId: 0 },
            events: ["onSelect"],
          },
        ],
      },
    };
    expectBothReject("stops cap", tree);
  });

  test("events-per-node cap", () => {
    // fillField has >8 allowed events, so a valid-name list can exceed the cap.
    const events = [
      "onTypeChange",
      "onColorChange",
      "onGradientChange",
      "onStopColorChange",
      "onStopPositionChange",
      "onAddStop",
      "onAddStopAt",
      "onRemoveStop",
      "onSelectStop",
    ];
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
    expect(events.length).toBeGreaterThan(PANEL_CAPS.eventsPerNode);
    expectBothReject("events cap", tree);
  });

  test("serialized string byte cap", () => {
    const huge = `{"padding":"${"a".repeat(PANEL_CAPS.treeBytes + 10)}"}`;
    expect(parsePanelTree(huge).ok).toBe(false);
    expect(decodePanelTree(huge).ok).toBe(false);
  });

  test("duplicate event name within a node", () => {
    const tree = {
      version: PANEL_TREE_VERSION,
      root: {
        type: "panel",
        id: 0,
        props: {},
        events: [],
        children: [
          { type: "button", id: 1, props: { label: "x" }, events: ["onClick", "onClick"] },
        ],
      },
    };
    expectBothReject("dup event name", tree);
  });
});

describe("panel schema contract — host is a strict superset (value-level)", () => {
  test("textField.kind outside text|number: OSS accepts, host rejects", () => {
    const tree = {
      version: PANEL_TREE_VERSION,
      root: {
        type: "panel",
        id: 0,
        props: {},
        events: [],
        children: [{ type: "textField", id: 1, props: { kind: "color" }, events: [] }],
      },
    };
    expectHostStricter("textField.kind", tree);
  });

  test("boolean prop given a string: OSS accepts, host rejects", () => {
    const tree = {
      version: PANEL_TREE_VERSION,
      root: {
        type: "panel",
        id: 0,
        props: {},
        events: [],
        children: [
          { type: "switchField", id: 1, props: { checked: "yes" }, events: [] },
        ],
      },
    };
    expectHostStricter("switchField.checked type", tree);
  });

  test("section.collapsible given a number: OSS accepts, host rejects", () => {
    const tree = {
      version: PANEL_TREE_VERSION,
      root: {
        type: "panel",
        id: 0,
        props: {},
        events: [],
        children: [
          { type: "section", id: 1, props: { collapsible: 1 }, events: [], children: [] },
        ],
      },
    };
    expectHostStricter("section.collapsible type", tree);
  });

  test("selectField.options entry missing value: OSS accepts, host rejects", () => {
    const tree = {
      version: PANEL_TREE_VERSION,
      root: {
        type: "panel",
        id: 0,
        props: {},
        events: [],
        children: [
          {
            type: "selectField",
            id: 1,
            props: { options: [{ label: "No value" }] },
            events: [],
          },
        ],
      },
    };
    expectHostStricter("selectField.options shape", tree);
  });

  test("gradientStops stop missing color: OSS accepts, host rejects", () => {
    const tree = {
      version: PANEL_TREE_VERSION,
      root: {
        type: "panel",
        id: 0,
        props: {},
        events: [],
        children: [
          {
            type: "gradientStops",
            id: 1,
            props: { stops: [{ id: 0, position: 0 }] },
            events: [],
          },
        ],
      },
    };
    expectHostStricter("gradientStops.stops shape", tree);
  });

  test("menu.value given a boolean: OSS accepts, host rejects", () => {
    const tree = {
      version: PANEL_TREE_VERSION,
      root: {
        type: "panel",
        id: 0,
        props: {},
        events: [],
        children: [{ type: "menu", id: 1, props: { value: true }, events: [] }],
      },
    };
    expectHostStricter("menu.value type", tree);
  });
});

describe("panel intent channel", () => {
  test("accepts a set-prop intent", () => {
    const result = decodePanelIntent({
      type: "set-prop",
      name: "heading",
      value: "Hello",
      gesture: "commit",
    });
    expect(result.ok).toBe(true);
  });

  test("accepts a live set-prop gesture", () => {
    expect(
      decodePanelIntent({ type: "set-prop", name: "size", value: 16, gesture: "live" }).ok,
    ).toBe(true);
  });

  test("accepts a set-ref intent (P0-B)", () => {
    const result = decodePanelIntent({
      type: "set-ref",
      name: "product",
      productId: "prod_123",
    });
    expect(result.ok).toBe(true);
  });

  test("accepts reset-prop / gesture-commit / gesture-discard", () => {
    expect(decodePanelIntent({ type: "reset-prop", name: "heading" }).ok).toBe(true);
    expect(decodePanelIntent({ type: "gesture-commit", name: "heading" }).ok).toBe(true);
    expect(decodePanelIntent({ type: "gesture-discard", name: "heading" }).ok).toBe(true);
  });

  test("rejects an unknown intent type", () => {
    expect(decodePanelIntent({ type: "explode", name: "x" }).ok).toBe(false);
  });

  test("rejects an unknown gesture", () => {
    expect(
      decodePanelIntent({ type: "set-prop", name: "x", value: 1, gesture: "hover" }).ok,
    ).toBe(false);
  });

  test("rejects a set-prop with an excess key", () => {
    expect(
      decodePanelIntent({ type: "set-prop", name: "x", value: 1, gesture: "live", extra: 1 }).ok,
    ).toBe(false);
  });

  test("rejects set-ref missing productId", () => {
    expect(decodePanelIntent({ type: "set-ref", name: "product" }).ok).toBe(false);
  });

  test("enforces the intent value byte cap", () => {
    const huge = "a".repeat(PANEL_CAPS.intentBytes + 10);
    const result = decodePanelIntent({
      type: "set-prop",
      name: "x",
      value: huge,
      gesture: "commit",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/bytes/);
  });

  test("allows a set-prop value just under the byte cap", () => {
    const nearlyHuge = "a".repeat(PANEL_CAPS.intentBytes - 100);
    expect(
      decodePanelIntent({ type: "set-prop", name: "x", value: nearlyHuge, gesture: "commit" }).ok,
    ).toBe(true);
  });
});
