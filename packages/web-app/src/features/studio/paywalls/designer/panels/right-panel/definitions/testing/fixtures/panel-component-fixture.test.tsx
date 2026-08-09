// @vitest-environment jsdom

/**
 * Runs the demo {@link featureCardWithPanel} fixture's custom `panel` through the
 * IN-PROCESS OSS session (no iframe — the sandbox transport is not exercised in
 * jsdom) and asserts the emitted wire tree is valid and composes the host
 * expansion nodes. This is the ground-truth that a custom panel authored with
 * `Panel.*` primitives (including `PropField` / `DefaultProps`) serializes to a
 * tree the host renderer can expand.
 */
import { createPanelSession, type PanelSessionInputs } from "@voidhash/paywalls/panel";
import { Effect } from "effect";
import { extractComponentManifest } from "@voidhash/paywalls";
import { definitionHasPanel } from "@voidhash/paywalls/sandbox";
import { describe, expect, test } from "vite-plus/test";

import { decodePanelTree, type PanelNode } from "../../../../../panel-runtime/schema";
import { featureCardWithPanel } from "./panel-component-fixture";

/** Depth-first walk yielding every node. */
function* walk(node: PanelNode): Generator<PanelNode> {
  yield node;
  for (const child of node.children ?? []) yield* walk(child);
}

function findByType(root: PanelNode, type: string): PanelNode | undefined {
  for (const node of walk(root)) if (node.type === type) return node;
  return undefined;
}

const inputs: PanelSessionInputs = {
  props: {
    title: { kind: "string", value: "Hello" },
    subtitle: { kind: "string", value: "World" },
    highlighted: { kind: "boolean", value: false },
    variant: { kind: "select", value: "solid" },
  },
  selection: { count: 1 },
  data: { products: [], variables: {} },
};

describe("panel-component-fixture", () => {
  test("the definition declares a panel and a §2 manifest", () => {
    expect(definitionHasPanel(featureCardWithPanel)).toBe(true);
    const manifest = extractComponentManifest(featureCardWithPanel);
    expect(Object.keys(manifest.props).sort()).toEqual([
      "highlighted",
      "subtitle",
      "title",
      "variant",
    ]);
    expect(manifest.props.variant).toMatchObject({ kind: "select", options: ["solid", "outline"] });
  });

  test("its panel serializes to a valid tree with PropField + DefaultProps nodes", () => {
    let latest: unknown;
    const session = createPanelSession({
      render: featureCardWithPanel.panel!,
      initialInputs: inputs,
      callbacks: {
        onTree: (tree) => {
          latest = tree;
        },
        onError: (error) => {
          Effect.runSync(Effect.die(error));
        },
      },
    });

    Effect.runSync(
      Effect.sync(() => {
        // Serialize → decode through the host gate, mirroring the sandbox boundary.
        const decoded = decodePanelTree(JSON.stringify(latest));
        expect(decoded.ok).toBe(true);
        if (!decoded.ok) return;

        const root = decoded.tree.root;
        // Two sections: "Content" and "Style".
        const sections = [...walk(root)].filter((n) => n.type === "section");
        expect(sections.map((s) => s.props.title)).toEqual(["Content", "Style"]);

        // The author-rendered TextField (title) + a PropField (subtitle) live under
        // the first section; a DefaultProps lives under the second.
        const propField = findByType(root, "propField");
        expect(propField?.props.name).toBe("subtitle");

        const defaultProps = findByType(root, "defaultProps");
        expect(defaultProps?.props.exclude).toEqual(["title", "subtitle"]);

        const textField = findByType(root, "textField");
        expect(textField?.props.value).toBe("Hello");
      }).pipe(Effect.ensuring(Effect.sync(() => session.dispose()))),
    );
  });
});
