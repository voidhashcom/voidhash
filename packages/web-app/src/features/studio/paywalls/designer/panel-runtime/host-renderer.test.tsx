// @vitest-environment jsdom

import { PANEL_NODE_SPECS, PANEL_TREE_VERSION } from "@voidhash/paywalls/schema";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Effect } from "effect";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

// The image field (and the fill field's image tab) read TanStack Router params
// and the studio auth context. Outside a real route, `useParams({strict:false})`
// returns `{}` — mock that faithfully so image nodes mount in a bare test.
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({}),
}));

import { AuthProvider } from "@/features/studio/components/auth-context";

import { PanelTreeView } from "./host-renderer";
import { decodePanelTree, type PanelTree } from "./schema";
import type { PanelDispatchEvent, PanelSnapshot, PanelTransport } from "./transport";

// oxlint-disable-next-line effect/noTestLifecycleHooks -- React Testing Library `cleanup()` unmounts the shared jsdom container between tests; it is owned by the RTL/vitest lifecycle, not by an Effect scope.
afterEach(() => cleanup());

/** Renders under the minimal app providers the designer kit components expect. */
const renderPanel = (ui: ReactNode) =>
  // The auth user is never dereferenced in these tests (org id resolves to null
  // via the mocked empty route params before `user` is read). A QueryClient is
  // provided because the `productField` view renders a `ProductInput` whose
  // `useQuery` needs a client in context (the query itself stays disabled without
  // a resolved project id).
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider user={null as never}>{ui}</AuthProvider>
    </QueryClientProvider>,
  );

/**
 * A stub transport over a fixed tree. Records every dispatch and lets a test
 * inspect what {@link PanelDispatchEvent}s the rendered nodes fired.
 */
const stubTransport = (tree: PanelTree) => {
  const dispatched: PanelDispatchEvent[] = [];
  const snapshot: PanelSnapshot = { status: "ready", tree, revision: 1 };
  const transport: PanelTransport = {
    kind: "in-process",
    update: () => {},
    dispatch: (event) => dispatched.push(event),
    subscribe: () => () => {},
    getSnapshot: () => snapshot,
    restart: () => {},
    dispose: () => {},
  };
  return { transport, dispatched };
};

let nextId = 0;
const id = () => nextId++;

/**
 * A fully-populated valid panel tree containing EVERY node type in the v1
 * vocabulary (adapted from the schema contract fixture). Every node carries the
 * events it supports so the renderer wires a handler per event name.
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
                  props: { label: "Add", icon: "plus", variant: "ghost", size: "icon-sm" },
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
            { type: "text", id: id(), props: { content: "Edit.", variant: "body" }, events: [] },
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
                kind: "text",
                value: "Hello",
                mixed: false,
                placeholder: "heading",
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
                  { value: "cover", label: "Cover" },
                  { value: "contain", label: "Contain" },
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
                  { value: "left", label: "Left" },
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
                { type: "text", id: id(), props: { content: "overridden" }, events: [] },
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
              ],
            },
            {
              type: "popover",
              id: id(),
              props: { open: true },
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
                      props: { label: "Edit fill" },
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
                      events: ["onColorChange", "onOpacityChange"],
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
                      events: ["onSelect", "onAddStop", "onMoveStop"],
                    },
                    {
                      type: "imageField",
                      id: id(),
                      props: { url: "", resizeMode: "cover" },
                      events: ["onPick", "onResizeModeChange", "onClear"],
                    },
                    {
                      type: "fillField",
                      id: id(),
                      props: {
                        label: "Fill",
                        backgroundType: "solid",
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
                      events: ["onTypeChange", "onColorChange", "onOpenChange"],
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
                  { value: "gradient", label: "Gradient" },
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
                productVariables: [],
                payloadFields: [],
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
            { type: "propField", id: id(), props: { name: "heading" }, events: [] },
            { type: "defaultProps", id: id(), props: { exclude: ["heading"] }, events: [] },
          ],
        },
      ],
    },
  };
};

describe("host-renderer — conformance", () => {
  // Mounting EVERY node type in one tree pulls in the heaviest composites
  // (fill/color pickers, the action editor, monaco-adjacent imports); under a
  // parallel suite run the first mount exceeds the 5s default.
  test("decodes and mounts a tree with every node type without crashing", { timeout: 30_000 }, () => {
    const decoded = decodePanelTree(fullTree());
    expect(decoded.ok, decoded.ok ? "" : decoded.error).toBe(true);
    if (!decoded.ok) return;

    const { transport } = stubTransport(decoded.tree);
    expect(() => renderPanel(<PanelTreeView transport={transport} />)).not.toThrow();
    // Text content from the fixture proves recursion reached leaf nodes.
    expect(screen.getByText("Edit.")).toBeTruthy();
    expect(screen.getByText("Product is unset.")).toBeTruthy();
  });

  test("the fixture exercises every node type in the vocabulary", () => {
    const seen = new Set<string>();
    const walk = (node: { type: string; children?: unknown[] }) => {
      seen.add(node.type);
      for (const child of node.children ?? []) {
        walk(child as { type: string; children?: unknown[] });
      }
    };
    walk(fullTree().root as never);
    for (const type of Object.keys(PANEL_NODE_SPECS)) {
      expect(seen.has(type), `fixture is missing node type "${type}"`).toBe(true);
    }
  });

  test("loading snapshot renders a skeleton, error renders restart chrome", () => {
    // Snapshots MUST be stable objects — useSyncExternalStore loops if getSnapshot
    // returns a new object each call.
    const loadingSnapshot: PanelSnapshot = { status: "loading" };
    const loading: PanelTransport = {
      ...stubTransport(decodeOrThrow(fullTree())).transport,
      getSnapshot: () => loadingSnapshot,
    };
    const { container: loadingContainer } = renderPanel(<PanelTreeView transport={loading} />);
    expect(loadingContainer.querySelector('[aria-busy="true"]')).toBeTruthy();
    cleanup();

    const restart = vi.fn();
    const errorSnapshot: PanelSnapshot = { status: "error", message: "boom", restartable: true };
    const errored: PanelTransport = {
      ...stubTransport(decodeOrThrow(fullTree())).transport,
      getSnapshot: () => errorSnapshot,
      restart,
    };
    renderPanel(<PanelTreeView transport={errored} />);
    expect(screen.getByText("boom")).toBeTruthy();
    fireEvent.click(screen.getByText("Restart"));
    expect(restart).toHaveBeenCalledTimes(1);
  });
});

const decodeOrThrow = (tree: unknown): PanelTree => {
  const decoded = decodePanelTree(tree);
  if (!decoded.ok) return Effect.runSync(Effect.die(new Error(decoded.error)));
  return decoded.tree;
};

describe("host-renderer — event dispatch", () => {
  const findEventNode = (
    tree: PanelTree,
    predicate: (node: { type: string; events: readonly string[] }) => boolean,
  ): number => {
    let found = -1;
    const walk = (node: { id: number; type: string; events: readonly string[]; children?: unknown[] }) => {
      if (found === -1 && predicate(node)) found = node.id;
      for (const child of node.children ?? []) {
        walk(child as never);
      }
    };
    walk(tree.root as never);
    return found;
  };

  test("textField onChange dispatches {nodeId, name}", () => {
    const tree = decodeOrThrow(fullTree());
    const { transport, dispatched } = stubTransport(tree);
    const nodeId = findEventNode(tree, (n) => n.type === "textField");
    renderPanel(<PanelTreeView transport={transport} />);
    fireEvent.change(screen.getByLabelText("heading"), { target: { value: "New" } });
    fireEvent.blur(screen.getByLabelText("heading"));
    const change = dispatched.find((e) => e.nodeId === nodeId && e.name === "onChange");
    expect(change).toBeTruthy();
  });

  test("button onClick dispatches {nodeId, name}", () => {
    const tree = decodeOrThrow(fullTree());
    const { transport, dispatched } = stubTransport(tree);
    const nodeId = findEventNode(tree, (n) => n.type === "button" && n.events.includes("onClick"));
    renderPanel(<PanelTreeView transport={transport} />);
    // An `icon-sm` button carries its label as the accessible name, not as text.
    fireEvent.click(screen.getByLabelText("Add"));
    const click = dispatched.find((e) => e.nodeId === nodeId && e.name === "onClick");
    expect(click).toBeTruthy();
  });

  test("switchField onChange dispatches {nodeId, name}", () => {
    const tree = decodeOrThrow(fullTree());
    const { transport, dispatched } = stubTransport(tree);
    const nodeId = findEventNode(tree, (n) => n.type === "switchField");
    const { container } = renderPanel(<PanelTreeView transport={transport} />);
    const toggle = container.querySelector('[data-slot="switch"]');
    expect(toggle).toBeTruthy();
    fireEvent.click(toggle!);
    const change = dispatched.find((e) => e.nodeId === nodeId && e.name === "onChange");
    expect(change).toBeTruthy();
  });

  test("textField trailingMenu (object shape) renders the trailing DropdownMenu trigger", () => {
    // The lineHeight Auto/Fixed control is the first real use of `trailingMenu`.
    // The wire carries the OBJECT `{ items, value? }` (not the array the OSS author
    // type annotates); the renderer must accept that shape and mount the trailing
    // DropdownMenu. (The onTrailingSelect dispatch is exercised end-to-end in the
    // typography-panel definition test through the transport — Radix's pointer-
    // driven open is not reliably reproducible in jsdom.)
    const tree = decodeOrThrow({
      version: PANEL_TREE_VERSION,
      root: {
        type: "panel",
        id: 0,
        props: {},
        events: [],
        children: [
          {
            type: "textField",
            id: 1,
            props: {
              kind: "number",
              value: "Auto",
              placeholder: "Line Height",
              disabled: true,
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
        ],
      },
    });
    const { transport } = stubTransport(tree);
    const { container } = renderPanel(<PanelTreeView transport={transport} />);
    // The trailing slot hosts a DropdownMenu trigger button (proves the object
    // trailingMenu shape decoded and reached the renderer).
    expect(container.querySelector('[data-slot="dropdown-menu-trigger"]')).toBeTruthy();
  });

  test("resetAffordance onReset dispatches {nodeId, name}", () => {
    const tree = decodeOrThrow(fullTree());
    const { transport, dispatched } = stubTransport(tree);
    const nodeId = findEventNode(tree, (n) => n.type === "resetAffordance");
    renderPanel(<PanelTreeView transport={transport} />);
    fireEvent.click(screen.getByLabelText("Reset Reset override"));
    const reset = dispatched.find((e) => e.nodeId === nodeId && e.name === "onReset");
    expect(reset).toBeTruthy();
  });

  test("dimensionField onChange dispatches the typed value in custom mode", () => {
    const tree = decodeOrThrow(fullTree());
    const { transport, dispatched } = stubTransport(tree);
    const nodeId = findEventNode(tree, (n) => n.type === "dimensionField");
    renderPanel(<PanelTreeView transport={transport} />);
    // The fixture field is axis:"width", mode:"custom" (input enabled, label "Width").
    fireEvent.change(screen.getByLabelText("Width"), { target: { value: "300" } });
    fireEvent.blur(screen.getByLabelText("Width"));
    const change = dispatched.find((e) => e.nodeId === nodeId && e.name === "onChange");
    expect(change).toBeTruthy();
  });

  test("dimensionField renders the fill/hug/custom menu trigger (onModeChange wired)", () => {
    const tree = decodeOrThrow(fullTree());
    const nodeId = findEventNode(tree, (n) => n.type === "dimensionField");
    const { transport } = stubTransport(tree);
    const { container } = renderPanel(<PanelTreeView transport={transport} />);
    // The trailing slot mounts a DropdownMenu whose items dispatch onModeChange
    // (Radix's pointer-open is unreliable in jsdom; the definition test drives the
    // mode change end-to-end through the transport).
    expect(container.querySelector('[data-slot="dropdown-menu-trigger"]')).toBeTruthy();
    expect(nodeId).toBeGreaterThanOrEqual(0);
  });

  test("alignmentGrid onChange dispatches {alignItems, justifyContent}", () => {
    const tree = decodeOrThrow(fullTree());
    const { transport, dispatched } = stubTransport(tree);
    const nodeId = findEventNode(tree, (n) => n.type === "alignmentGrid");
    const { container } = renderPanel(<PanelTreeView transport={transport} />);
    // The alignment grid renders clickable cells; clicking one emits the paired
    // { alignItems, justifyContent } object the definition writes DIRECT.
    const cell = container.querySelector(".group.relative");
    expect(cell).toBeTruthy();
    fireEvent.click(cell!);
    const change = dispatched.find((e) => e.nodeId === nodeId && e.name === "onChange");
    expect(change).toBeTruthy();
    expect(change?.args[0]).toMatchObject({
      alignItems: expect.any(String),
      justifyContent: expect.any(String),
    });
  });

  test("alignmentGrid with a stretch parent renders the plain grid; a cell click emits its explicit alignment", () => {
    const tree = decodeOrThrow({
      version: PANEL_TREE_VERSION,
      root: {
        type: "panel",
        id: 0,
        props: {},
        events: [],
        children: [
          {
            type: "alignmentGrid",
            id: 1,
            props: {
              flexDirection: "row",
              alignItems: "stretch",
              justifyContent: "flex-start",
              mixed: false,
            },
            events: ["onChange"],
          },
        ],
      },
    });
    const { transport, dispatched } = stubTransport(tree);
    const { container } = renderPanel(<PanelTreeView transport={transport} />);
    // Virtual stretch: `alignItems: "stretch"` is no longer a grid state —
    // the grid renders as 3x3 with no selection, and picking a cell emits
    // that cell's explicit alignment (the host expands filling children).
    const cell = container.querySelector(".group.relative");
    expect(cell).toBeTruthy();
    fireEvent.click(cell!);
    const change = dispatched.find((e) => e.name === "onChange");
    expect(change?.args[0]).toMatchObject({
      alignItems: "flex-start",
      justifyContent: "flex-start",
    });
  });

  /**
   * A single `fillField` node with the eight WRITE-bearing events wired. The
   * popover open state and selected gradient stop are HOST-LOCAL (never on the
   * wire — the fillField composite has 15 events but the per-node cap is 8), so
   * the fixture never carries `open`/`selectedStopIndex` as live wire props.
   */
  const fillFieldTree = (): PanelTree =>
    decodeOrThrow({
      version: PANEL_TREE_VERSION,
      root: {
        type: "panel",
        id: 0,
        props: {},
        events: [],
        children: [
          {
            type: "fillField",
            id: 1,
            props: {
              label: "Fill",
              backgroundType: "solid",
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
              image: { url: "", resizeMode: "cover" },
            },
            // The eight write-bearing events (the pure-UI open + stop selection are
            // host-local); stop-shape mutations consolidate into onGradientChange.
            events: [
              "onTypeChange",
              "onColorChange",
              "onGradientChange",
              "onImageUrlChange",
              "onImageResizeModeChange",
              "onGestureStart",
              "onCommit",
              "onDiscard",
            ],
          },
        ],
      },
    });

  test("fillField mounts the composite and opens its popover body host-locally", () => {
    const { transport } = stubTransport(fillFieldTree());
    // The composite renders the trigger button; the popover open state is host-
    // local so it starts closed and opens on trigger click, exposing the
    // Solid/Gradient/Image type toggle (proves the FillEditorPopoverContent mounts).
    expect(() => renderPanel(<PanelTreeView transport={transport} />)).not.toThrow();
    fireEvent.click(screen.getByLabelText("Edit fill"));
    expect(screen.getByText("Solid")).toBeTruthy();
    expect(screen.getByText("Gradient")).toBeTruthy();
  });

  test("fillField onTypeChange dispatches the picked background type", () => {
    const { transport, dispatched } = stubTransport(fillFieldTree());
    renderPanel(<PanelTreeView transport={transport} />);
    fireEvent.click(screen.getByLabelText("Edit fill"));
    // Switching the type tab to Gradient dispatches onTypeChange("gradient").
    fireEvent.click(screen.getByText("Gradient"));
    const change = dispatched.find((e) => e.nodeId === 1 && e.name === "onTypeChange");
    expect(change).toBeTruthy();
    expect(change?.args[0]).toBe("gradient");
  });

  /** A `fillField` whose active type is `gradient` (so the gradient body renders). */
  const gradientFillFieldTree = (): PanelTree => {
    const raw = JSON.parse(JSON.stringify(fillFieldTree())) as {
      root: { children: { props: { backgroundType: string } }[] };
    };
    raw.root.children[0]!.props.backgroundType = "gradient";
    return decodeOrThrow(raw);
  };

  test("fillField consolidates a stop color change into a whole-gradient onGradientChange", () => {
    const { transport, dispatched } = stubTransport(gradientFillFieldTree());
    renderPanel(<PanelTreeView transport={transport} />);
    fireEvent.click(screen.getByLabelText("Edit fill"));
    // The gradient tab renders a per-stop ColorInput with an inline hex field;
    // typing a new hex fires the composite's onStopColorChange, which the host
    // view consolidates into a single onGradientChange carrying the WHOLE rebuilt
    // stops array (per-stop events are NOT on the wire).
    const hexInputs = screen.getAllByLabelText("Hex color code");
    fireEvent.change(hexInputs[0]!, { target: { value: "112233" } });
    const change = dispatched.find((e) => e.nodeId === 1 && e.name === "onGradientChange");
    expect(change).toBeTruthy();
    const nextGradient = change?.args[0] as { stops: { color: string; position: number }[] };
    // Two stops survive the rebuild (the regression this consolidation guards).
    expect(nextGradient.stops).toHaveLength(2);
    expect(nextGradient.stops[0]!.color).toContain("17, 34, 51");
    // No granular stop event ever crosses the wire.
    expect(dispatched.some((e) => e.name === "onStopColorChange")).toBe(false);
  });

  test("fillField add-stop consolidates into an onGradientChange appending a stop", () => {
    const { transport, dispatched } = stubTransport(gradientFillFieldTree());
    renderPanel(<PanelTreeView transport={transport} />);
    fireEvent.click(screen.getByLabelText("Edit fill"));
    // The gradient tab's "Add stop" button appends a stop via the host view's
    // consolidation → one onGradientChange with THREE stops.
    fireEvent.click(screen.getByLabelText("Add stop"));
    const change = dispatched.find((e) => e.nodeId === 1 && e.name === "onGradientChange");
    expect(change).toBeTruthy();
    const next = change?.args[0] as { stops: { position: number }[] };
    expect(next.stops).toHaveLength(3);
    expect(dispatched.some((e) => e.name === "onAddStop")).toBe(false);
  });

  test("fillField remove-stop honors the ≤2 guard (disabled, no dispatch at two stops)", () => {
    const { transport, dispatched } = stubTransport(gradientFillFieldTree());
    renderPanel(<PanelTreeView transport={transport} />);
    fireEvent.click(screen.getByLabelText("Edit fill"));
    // With exactly two stops, every per-stop remove button is disabled (the old
    // section's `≤2` guard, replicated host-local) — clicking dispatches nothing.
    const removeButtons = screen.getAllByLabelText("Remove stop");
    expect(removeButtons).toHaveLength(2);
    for (const button of removeButtons) expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(removeButtons[0]!);
    expect(dispatched.some((e) => e.name === "onGradientChange")).toBe(false);
    expect(dispatched.some((e) => e.name === "onRemoveStop")).toBe(false);
  });

  test("fillField remove-stop above the guard consolidates into onGradientChange", () => {
    // A three-stop gradient: removing one drops back to two via a single
    // whole-gradient onGradientChange.
    const raw = JSON.parse(JSON.stringify(fillFieldTree())) as {
      root: { children: { props: { backgroundType: string; gradient: { stops: unknown[] } } }[] };
    };
    const node = raw.root.children[0]!;
    node.props.backgroundType = "gradient";
    node.props.gradient.stops = [
      { color: "rgba(0,0,0,1)", position: 0 },
      { color: "rgba(128,128,128,1)", position: 0.5 },
      { color: "rgba(255,255,255,1)", position: 1 },
    ];
    const { transport, dispatched } = stubTransport(decodeOrThrow(raw));
    renderPanel(<PanelTreeView transport={transport} />);
    fireEvent.click(screen.getByLabelText("Edit fill"));
    const removeButtons = screen.getAllByLabelText("Remove stop");
    expect(removeButtons).toHaveLength(3);
    for (const button of removeButtons) expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(removeButtons[1]!);
    const change = dispatched.find((e) => e.nodeId === 1 && e.name === "onGradientChange");
    expect(change).toBeTruthy();
    const next = change?.args[0] as { stops: { position: number }[] };
    expect(next.stops).toHaveLength(2);
    expect(next.stops.map((s) => s.position)).toEqual([0, 1]);
  });
});

describe("host-renderer — layout parity fixes", () => {
  /** A `panel` root wrapping `children`, decoded through the host gate. */
  const treeWithChildren = (children: unknown[]): PanelTree =>
    decodeOrThrow({
      version: PANEL_TREE_VERSION,
      root: { type: "panel", id: 0, props: {}, events: [], children },
    });

  test("A1: a toggleGroup does NOT get a `w-full` class (sizes to content)", () => {
    // A fillRule-style group sitting in a `justify-between` row must stay
    // content-sized (`w-fit`, the kit default) so the row's `−` button keeps its
    // gap — the legacy sections never set `w-full` on the group itself.
    const tree = treeWithChildren([
      {
        type: "row",
        id: 1,
        props: { justify: "between" },
        events: [],
        children: [
          {
            type: "toggleGroup",
            id: 2,
            props: {
              value: "nonzero",
              options: [
                { value: "nonzero", label: "Nonzero" },
                { value: "evenodd", label: "Even-odd" },
              ],
            },
            events: ["onChange"],
          },
          { type: "button", id: 3, props: { icon: "minus", size: "icon-sm" }, events: ["onClick"] },
        ],
      },
    ]);
    const { transport } = stubTransport(tree);
    const { container } = renderPanel(<PanelTreeView transport={transport} />);
    const group = container.querySelector('[data-slot="toggle-group"]')!;
    expect(group).toBeTruthy();
    // The group is content-sized: `w-fit` from the kit, no `w-full` override.
    expect(group.classList.contains("w-full")).toBe(false);
    expect(group.classList.contains("w-fit")).toBe(true);
    // Items keep `flex-1`, byte-matching the old segmented-control markup.
    const items = container.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(2);
    for (const item of items) expect(item.classList.contains("flex-1")).toBe(true);
  });

  test("A2: a section whose only child is sectionActions renders no content container", () => {
    // The enable `+` button lives in the header via `sectionActions`; with no body
    // children the section must render NO `PanelSectionContent` (its `px-4 pb-4`
    // container would otherwise add ~16px of dead space).
    const tree = treeWithChildren([
      {
        type: "section",
        id: 1,
        props: { title: "Border" },
        events: [],
        children: [
          {
            type: "sectionActions",
            id: 2,
            props: {},
            events: [],
            children: [
              { type: "button", id: 3, props: { icon: "plus", size: "icon-sm" }, events: ["onClick"] },
            ],
          },
        ],
      },
    ]);
    const { transport } = stubTransport(tree);
    const { container } = renderPanel(<PanelTreeView transport={transport} />);
    // The header + its action button render…
    expect(screen.getByText("Border")).toBeTruthy();
    expect(container.querySelector("button")).toBeTruthy();
    // …but the content container (`px-4 pb-4` from PanelSectionContent) does not.
    expect(container.querySelector(".pb-4.px-4, .px-4.pb-4")).toBeNull();
  });

  test("A2: a section WITH body children still renders the content container", () => {
    const tree = treeWithChildren([
      {
        type: "section",
        id: 1,
        props: { title: "Fill" },
        events: [],
        children: [
          {
            type: "sectionActions",
            id: 2,
            props: {},
            events: [],
            children: [
              { type: "button", id: 3, props: { icon: "minus", size: "icon-sm" }, events: ["onClick"] },
            ],
          },
          { type: "text", id: 4, props: { content: "Body" }, events: [] },
        ],
      },
    ]);
    const { transport } = stubTransport(tree);
    const { container } = renderPanel(<PanelTreeView transport={transport} />);
    expect(screen.getByText("Body")).toBeTruthy();
    expect(container.querySelector(".px-4.pb-4, .pb-4.px-4")).toBeTruthy();
  });

  test("A3: a toggleGroup WITH `width: full` stretches", () => {
    const tree = treeWithChildren([
      {
        type: "toggleGroup",
        id: 1,
        props: {
          value: "column",
          width: "full",
          options: [
            { value: "column", icon: "arrowDown" },
            { value: "row", icon: "arrowRight" },
          ],
        },
        events: ["onChange"],
      },
    ]);
    const { transport } = stubTransport(tree);
    const { container } = renderPanel(<PanelTreeView transport={transport} />);
    const group = container.querySelector('[data-slot="toggle-group"]')!;
    expect(group.classList.contains("w-full")).toBe(true);
    expect(group.classList.contains("w-fit")).toBe(false);
  });

  test("A4: row/column carry their gap and width tokens", () => {
    const tree = treeWithChildren([
      {
        type: "row",
        id: 1,
        props: { gap: "xs", align: "start" },
        events: [],
        children: [
          { type: "column", id: 2, props: { gap: "md", width: "full" }, events: [], children: [] },
          { type: "column", id: 3, props: { width: "auto" }, events: [], children: [] },
        ],
      },
    ]);
    const { transport } = stubTransport(tree);
    const { container } = renderPanel(<PanelTreeView transport={transport} />);
    const row = container.querySelector(".flex-row")!;
    expect(row.classList.contains("gap-1")).toBe(true);
    expect(row.classList.contains("items-start")).toBe(true);
    const columns = container.querySelectorAll(".flex-col");
    expect(columns[0]!.classList.contains("gap-3")).toBe(true);
    expect(columns[0]!.classList.contains("w-full")).toBe(true);
    // `auto` hugs its content instead of dividing the row.
    expect(columns[1]!.classList.contains("w-auto")).toBe(true);
    expect(columns[1]!.classList.contains("gap-2")).toBe(true);
  });

  test("A5: a resetAffordance fills its slot around an input, hugs around a toggle", () => {
    const tree = treeWithChildren([
      {
        type: "row",
        id: 1,
        props: {},
        events: [],
        children: [
          {
            type: "resetAffordance",
            id: 2,
            props: { label: "gap", show: false },
            events: ["onReset"],
            children: [
              { type: "textField", id: 3, props: { kind: "number", value: "0" }, events: ["onChange"] },
            ],
          },
          {
            type: "resetAffordance",
            id: 4,
            props: { label: "direction", show: false },
            events: ["onReset"],
            children: [
              {
                type: "toggleGroup",
                id: 5,
                props: { value: "row", options: [{ value: "row", label: "Row" }] },
                events: ["onChange"],
              },
            ],
          },
        ],
      },
    ]);
    const { transport } = stubTransport(tree);
    const { container } = renderPanel(<PanelTreeView transport={transport} />);
    // The two affordance wrappers are the row's own children (an input's own
    // `relative` InputGroup sits deeper, so query the row directly).
    const wrappers = [...container.querySelector(".flex-row")!.children];
    expect(wrappers).toHaveLength(2);
    expect(wrappers[0]!.classList.contains("w-full")).toBe(true);
    expect(wrappers[1]!.classList.contains("w-full")).toBe(false);
  });

  test("A6: a menu with an `icon` renders that glyph, not the default chevron", () => {
    const withIcon = treeWithChildren([
      {
        type: "menu",
        id: 1,
        props: { icon: "plus", items: [{ value: "string", label: "Text" }] },
        events: ["onSelect"],
      },
    ]);
    const { container } = renderPanel(
      <PanelTreeView transport={stubTransport(withIcon).transport} />,
    );
    expect(container.querySelector("svg")?.getAttribute("class")).toContain("lucide-plus");

    cleanup();
    const bare = treeWithChildren([
      {
        type: "menu",
        id: 1,
        props: { items: [{ value: "string", label: "Text" }] },
        events: ["onSelect"],
      },
    ]);
    const bareRender = renderPanel(<PanelTreeView transport={stubTransport(bare).transport} />);
    expect(bareRender.container.querySelector("svg")?.getAttribute("class")).toContain(
      "lucide-chevron-down",
    );
  });

  test("A7: a button renders its `hint` muted and stretches at `width: full`", () => {
    const tree = treeWithChildren([
      {
        type: "button",
        id: 1,
        props: { label: "greeting", hint: "hi", size: "sm", width: "full" },
        events: ["onClick"],
      },
    ]);
    const { container } = renderPanel(
      <PanelTreeView transport={stubTransport(tree).transport} />,
    );
    const button = container.querySelector("button")!;
    expect(button.classList.contains("w-full")).toBe(true);
    expect(button.classList.contains("justify-between")).toBe(true);
    // It must give width back to a trailing sibling (the button base is shrink-0).
    expect(button.classList.contains("shrink")).toBe(true);
    expect(button.classList.contains("shrink-0")).toBe(false);
    expect(screen.getByText("hi").classList.contains("text-muted-foreground")).toBe(true);
    expect(screen.getByText("greeting")).toBeTruthy();
  });

  test("A10: an icon-sized button labels itself instead of spilling visible text", () => {
    // The Position section's absolute toggle is `icon="scan" size="icon-sm"` with a
    // descriptive label; rendering that label as text overflowed the square button.
    const tree = treeWithChildren([
      {
        type: "button",
        id: 1,
        props: { label: "Absolute position", icon: "scan", size: "icon-sm", variant: "ghost" },
        events: ["onClick"],
      },
    ]);
    const { container } = renderPanel(
      <PanelTreeView transport={stubTransport(tree).transport} />,
    );
    expect(screen.getByLabelText("Absolute position")).toBeTruthy();
    expect(container.textContent).toBe("");
  });

  test("A9: a popoverTrigger renders its child button and keeps it clickable", () => {
    // Radix `asChild` clones ONE element child; handing it an array (or a
    // Fragment) rendered nothing at all, so every popover row in the Variables /
    // Interactions / Component-actions panels showed only its trailing `−`.
    const tree = treeWithChildren([
      {
        type: "popover",
        id: 1,
        props: { open: false },
        events: ["onOpenChange"],
        children: [
          {
            type: "popoverTrigger",
            id: 2,
            props: {},
            events: [],
            children: [
              {
                type: "button",
                id: 3,
                props: { label: "greeting", hint: "hi", width: "full" },
                events: ["onClick"],
              },
            ],
          },
          {
            type: "popoverContent",
            id: 4,
            props: {},
            events: [],
            children: [{ type: "text", id: 5, props: { content: "Body" }, events: [] }],
          },
        ],
      },
    ]);
    const { transport, dispatched } = stubTransport(tree);
    renderPanel(<PanelTreeView transport={transport} />);
    // The trigger renders as a real button…
    const trigger = screen.getByText("greeting").closest("button")!;
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    // …and Slot merged its handler with the node's own `onClick`.
    fireEvent.click(trigger);
    expect(dispatched).toContainEqual({ nodeId: 3, name: "onClick", args: [] });
  });

  test("A8: a popoverContent `title` renders a header whose close dispatches onClose", () => {
    const tree = treeWithChildren([
      {
        type: "popover",
        id: 1,
        props: { open: true },
        events: ["onOpenChange"],
        children: [
          {
            type: "popoverTrigger",
            id: 2,
            props: {},
            events: [],
            children: [{ type: "button", id: 3, props: { label: "Open" }, events: ["onClick"] }],
          },
          {
            type: "popoverContent",
            id: 4,
            props: { title: "Variable" },
            events: ["onClose"],
            children: [{ type: "text", id: 5, props: { content: "Body" }, events: [] }],
          },
        ],
      },
    ]);
    const { transport, dispatched } = stubTransport(tree);
    renderPanel(<PanelTreeView transport={transport} />);
    expect(screen.getByText("Variable")).toBeTruthy();
    const closeButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg")?.getAttribute("class")?.includes("lucide-x"))!;
    fireEvent.click(closeButton);
    expect(dispatched).toEqual([{ nodeId: 4, name: "onClose", args: [] }]);
  });
});

describe("host-renderer — image url scheme allowlist", () => {
  const treeWith = (nodeType: "swatch" | "imageField", url: string): PanelTree => {
    const props =
      nodeType === "swatch"
        ? { color: "rgba(0,0,0,1)", imageUrl: url }
        : { url, resizeMode: "cover" };
    const raw = {
      version: PANEL_TREE_VERSION,
      root: {
        type: "panel",
        id: 0,
        props: {},
        events: [],
        children: [
          {
            type: nodeType,
            id: 1,
            props,
            events: nodeType === "imageField" ? ["onPick", "onResizeModeChange", "onClear"] : [],
          },
        ],
      },
    };
    return decodeOrThrow(raw);
  };

  test("rejects a javascript: url on swatch (renders no image)", () => {
    const { transport } = stubTransport(treeWith("swatch", "javascript:alert(1)"));
    const { container } = renderPanel(<PanelTreeView transport={transport} />);
    expect(container.querySelector("img")).toBeNull();
  });

  test("rejects a http: (non-https) url on imageField (renders no image)", () => {
    const { transport } = stubTransport(treeWith("imageField", "http://evil.test/x.png"));
    const { container } = renderPanel(<PanelTreeView transport={transport} />);
    expect(container.querySelector("img")).toBeNull();
  });

  test("accepts an https: image url on swatch (renders the image)", () => {
    const { transport } = stubTransport(treeWith("swatch", "https://cdn.test/x.png"));
    const { container } = renderPanel(<PanelTreeView transport={transport} />);
    expect(container.querySelector("img")).toBeTruthy();
  });
});
