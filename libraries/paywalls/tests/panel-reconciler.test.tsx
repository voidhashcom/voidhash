import { describe, expect, it, vi } from "vitest";

import {
  createPanelSession,
  Panel,
  type PanelSessionInputs,
} from "../src/panel/index";
import type { PanelTree } from "../src/schema/panel-tree";
import { parsePanelTree } from "../src/schema/validate-panel";

/** A collector that records every emitted `(tree, revision)`. */
const makeCollector = () => {
  const trees: Array<{ tree: PanelTree; revision: number }> = [];
  const errors: unknown[] = [];
  return {
    trees,
    errors,
    callbacks: {
      onTree: (tree: PanelTree, revision: number) => {
        trees.push({ tree, revision });
      },
      onError: (error: unknown) => {
        errors.push(error);
      },
    },
    last: () => trees[trees.length - 1]!,
  };
};

const emptyInputs: PanelSessionInputs = {
  props: {},
  selection: { count: 1 },
  data: { products: [], variables: {} },
};

/** Finds the first node of `type` in a tree, depth-first. */
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

describe("panel reconciler — serialization", () => {
  it("serializes a fixture using every primitive into a valid PanelTree", () => {
    const collector = makeCollector();
    const session = createPanelSession({
      render: () => (
        <Panel>
          <Panel.Section title="Layout" collapsible defaultCollapsed onToggle={() => {}}>
            <Panel.SectionActions>
              <Panel.Button icon="plus" onClick={() => {}} />
            </Panel.SectionActions>
            <Panel.Subsection title="Spacing">
              <Panel.Row gap="sm" width="full" align="center" justify="between">
                <Panel.Column gap="xs" width="half" align="start">
                  <Panel.Field label="Name" icon="type">
                    <Panel.TextField kind="text" value="hi" onChange={() => {}} onCommit={() => {}} />
                  </Panel.Field>
                  <Panel.Text content="Hello" variant="label" tone="muted" />
                  <Panel.Callout message="Note" tone="info" />
                </Panel.Column>
              </Panel.Row>
            </Panel.Subsection>
            <Panel.Popover open onOpenChange={() => {}}>
              <Panel.PopoverTrigger>
                <Panel.Button label="Open" onClick={() => {}} />
              </Panel.PopoverTrigger>
              <Panel.PopoverContent align="start" side="bottom">
                <Panel.Menu items={[{ value: "a", label: "A" }]} value="a" onSelect={() => {}} />
                <Panel.SelectField
                  value="a"
                  options={[{ value: "a" }]}
                  onChange={() => {}}
                />
                <Panel.ToggleGroup value="a" options={[{ value: "a" }]} onChange={() => {}} />
                <Panel.SwitchField checked label="On" onChange={() => {}} />
                <Panel.SliderField value={5} min={0} max={10} onChange={() => {}} onCommit={() => {}} />
                <Panel.ResetAffordance show label="Reset" onReset={() => {}}>
                  <Panel.ColorField value="#fff" onChange={() => {}} onCommit={() => {}} />
                </Panel.ResetAffordance>
                <Panel.ColorPicker color="#fff" opacity={1} onColorChange={() => {}} />
                <Panel.GradientStops
                  stops={[{ id: "s1", pos: 0, value: "#000" }]}
                  selectedStopId="s1"
                  onSelect={() => {}}
                />
                <Panel.Swatch color="#fff" />
                <Panel.ImageField url="u" resizeMode="cover" onPick={() => {}} />
                <Panel.AlignmentGrid flexDirection="row" onChange={() => {}} />
                <Panel.DimensionField axis="width" value={100} onChange={() => {}} />
                <Panel.FillField label="Fill" backgroundType="color" onColorChange={() => {}} />
                <Panel.VariableField variableName="v" onBind={() => {}} />
                <Panel.ActionEditorField value={{ kind: "close" }} onChange={() => {}} />
                <Panel.PropField name="accentColor" />
                <Panel.DefaultProps exclude={["accentColor"]} />
              </Panel.PopoverContent>
            </Panel.Popover>
          </Panel.Section>
        </Panel>
      ),
      initialInputs: emptyInputs,
      callbacks: collector.callbacks,
    });

    const tree = session.getTree();
    // Round-trip through the strict wire validator (serialize → JSON → parse).
    const result = parsePanelTree(JSON.stringify(tree));
    expect(result.ok).toBe(true);

    // Events split out of props: the section's onToggle became an event name.
    const section = findNode(tree, "section")!;
    expect(section.events).toContain("onToggle");
    expect("onToggle" in section.props).toBe(false);
    session.dispose();
  });

  it("drops a function prop outside the event allowlist with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const collector = makeCollector();
    // `onBogus` is not in <button>'s event allowlist; the primitive is typed
    // so it is passed through an untyped element to reach the serializer.
    const bogusProps = { label: "x", onBogus: () => {} };
    const session = createPanelSession({
      render: () => <Panel>{Panel.Button(bogusProps as never)}</Panel>,
      initialInputs: emptyInputs,
      callbacks: collector.callbacks,
    });
    const button = findNode(session.getTree(), "button")!;
    expect(button.events).not.toContain("onBogus");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    session.dispose();
  });
});

describe("panel reconciler — updates & ids", () => {
  it("keeps a node's id stable across re-render when props change", () => {
    const collector = makeCollector();
    const session = createPanelSession({
      render: (ctx) => (
        <Panel>
          <Panel.Section title={`T-${ctx.selection.count}`}>
            <Panel.Button label={`stable-${ctx.selection.count}`} onClick={() => {}} />
          </Panel.Section>
        </Panel>
      ),
      initialInputs: emptyInputs,
      callbacks: collector.callbacks,
    });
    const before = findNode(session.getTree(), "button")!;
    // A prop change on the button (label) — mutation mode reuses the instance.
    session.update({ ...emptyInputs, selection: { count: 9 } });
    const after = findNode(session.getTree(), "button")!;
    expect(after.props.label).toBe("stable-9");
    expect(after.id).toBe(before.id);
    session.dispose();
  });

  it("mints a fresh id when a node unmounts and remounts", () => {
    const collector = makeCollector();
    const session = createPanelSession<Record<string, never>>({
      render: (ctx) => (
        <Panel>
          {ctx.selection.count > 0 ? <Panel.Button label="a" onClick={() => {}} /> : null}
        </Panel>
      ),
      initialInputs: emptyInputs,
      callbacks: collector.callbacks,
    });
    const firstId = findNode(session.getTree(), "button")!.id;
    // Unmount the button.
    session.update({ ...emptyInputs, selection: { count: 0 } });
    expect(findNode(session.getTree(), "button")).toBeUndefined();
    // Remount it.
    session.update({ ...emptyInputs, selection: { count: 1 } });
    const secondId = findNode(session.getTree(), "button")!.id;
    expect(secondId).not.toBe(firstId);
    session.dispose();
  });
});

describe("panel reconciler — microtask coalescing", () => {
  it("emits once for two synchronous updates in one tick", async () => {
    const collector = makeCollector();
    const session = createPanelSession({
      render: (ctx) => (
        <Panel>
          <Panel.Text content={`count=${ctx.selection.count}`} />
        </Panel>
      ),
      initialInputs: emptyInputs,
      callbacks: collector.callbacks,
    });
    const baseRevisions = collector.trees.length;
    // Two synchronous host updates before the microtask drains.
    session.update({ ...emptyInputs, selection: { count: 2 } });
    session.update({ ...emptyInputs, selection: { count: 3 } });
    await Promise.resolve();
    await Promise.resolve();
    // Exactly one new emission, reflecting the latest (count=3).
    expect(collector.trees.length).toBe(baseRevisions + 1);
    expect(findNode(collector.last().tree, "text")!.props.content).toBe("count=3");
    session.dispose();
  });
});
