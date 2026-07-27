import { useEffect, useState } from "react";
import { describe, expect, it } from "vitest";

import {
  defineComponent,
  Pressable,
  Slot,
  Text,
  useDimensions,
  usePaywallVariables,
  usePlatform,
  useSafeAreaInsets,
  View,
} from "../src/index";
import { Panel } from "../src/panel/index";
import { parseComponentManifest, parsePreviewTree } from "../src/schema/validate";
import {
  defaultHostData,
  definitionHasPanel,
  describeComponent,
  extractComponentManifest,
  renderComponentToTree,
} from "../src/sandbox";

/**
 * A fixture exercising the determinism-sensitive surface: `useState` +
 * `useEffect` (a settled state update), a branded `Pressable` action, a
 * `<Slot/>`, and two preview states.
 */
const definition = defineComponent({
  title: "Product Option",
  props: (p) => ({
    accentColor: p.string().editor("color").default("#16a34a"),
  }),
  actions: (a) => ({ onSelect: a.action({ productId: a.string() }) }),
  previews: {
    default: {},
    trial: { props: { accentColor: "#2563eb" } },
  },
  render: ({ props, actions }) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
      // A one-shot state update that must settle before serialization.
      setCount(1);
    }, []);
    return (
      <Pressable
        onPress={actions.onSelect}
        style={{
          paddingTop: 16,
          paddingRight: 16,
          paddingBottom: 16,
          paddingLeft: 16,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          borderBottomRightRadius: 12,
          borderBottomLeftRadius: 12,
          backgroundColor: props.accentColor,
        }}
      >
        <View style={{ gap: 4 }}>
          <Text style={{ color: "white", fontWeight: "700" }}>Selected {count}</Text>
        </View>
        <Slot />
      </Pressable>
    );
  },
});

describe("sandbox renderComponentToTree", () => {
  it("renders a deterministic, byte-identical tree across two runs", async () => {
    const hostData = defaultHostData();
    const first = await renderComponentToTree(definition, {
      hostData,
      state: "default",
    });
    const second = await renderComponentToTree(definition, {
      hostData,
      state: "default",
    });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("settles a useEffect-driven state update before serializing", async () => {
    const tree = await renderComponentToTree(definition, { state: "default" });
    expect(JSON.stringify(tree)).toContain("Selected 1");
  });

  it("records the branded action name and emits the slot marker", async () => {
    const tree = await renderComponentToTree(definition, { state: "default" });
    const result = parsePreviewTree(tree);
    expect(result.ok).toBe(true);
    if (tree.root.type !== "pressable") {
      throw new Error("expected a pressable root");
    }
    expect(tree.root.action).toBe("onSelect");
    expect(JSON.stringify(tree)).toContain('"type":"slot"');
  });

  it("records the action name for the idiomatic inline-arrow handler", async () => {
    const inlineDefinition = defineComponent({
      actions: (a) => ({ onSelect: a.action({ productId: a.string() }) }),
      render: ({ actions }) => (
        <Pressable onPress={() => actions.onSelect({ productId: "p1" })}>
          <Text>Buy</Text>
        </Pressable>
      ),
    });
    const tree = await renderComponentToTree(inlineDefinition, {
      state: "default",
    });
    if (tree.root.type !== "pressable") {
      throw new Error("expected a pressable root");
    }
    // The inline arrow is unbranded; the tree host probes it to record the name.
    expect(tree.root.action).toBe("onSelect");

    // The probe must not perturb the committed tree — still byte-stable.
    const again = await renderComponentToTree(inlineDefinition, {
      state: "default",
    });
    expect(JSON.stringify(tree)).toBe(JSON.stringify(again));
  });

  it("stays deterministic when an inline handler also updates state", async () => {
    // The action probe must NOT run the author's setState during the committed
    // render — otherwise the counter compounds and differs run-to-run.
    const stateful = defineComponent({
      actions: (a) => ({ onSelect: a.action() }),
      render: ({ actions }) => {
        const [n, setN] = useState(0);
        return (
          <Pressable
            onPress={() => {
              setN((v) => v + 1);
              actions.onSelect();
            }}
          >
            <Text>n={n}</Text>
          </Pressable>
        );
      },
    });
    const first = await renderComponentToTree(stateful, { state: "default" });
    const second = await renderComponentToTree(stateful, { state: "default" });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    if (first.root.type !== "pressable" || first.root.children[0]?.type !== "text") {
      throw new Error("expected a pressable wrapping text");
    }
    // The counter reflects the initial render only — the probe left no trace.
    expect(first.root.children[0].text).toBe("n=0");
    expect(first.root.action).toBe("onSelect");
  });

  it("flows preview-state variables into usePaywallVariables", async () => {
    const withVars = defineComponent({
      render: () => {
        const variables = usePaywallVariables();
        return <Text>{String(variables.headline ?? "NONE")}</Text>;
      },
    });
    const hostData = {
      ...defaultHostData(),
      variables: { headline: "FromFixture" },
    };
    const tree = await renderComponentToTree(withVars, {
      hostData,
      state: "default",
    });
    if (tree.root.type !== "text") {
      throw new Error("expected a text root");
    }
    expect(tree.root.text).toBe("FromFixture");
  });

  it("uses deterministic default device metrics and per-state environment overrides", async () => {
    const withEnvironment = defineComponent({
      previews: {
        iphone: {
          data: {
            platform: "ios",
            safeAreaInsets: { top: 59, right: 0, bottom: 34, left: 0 },
            dimensions: {
              screen: { width: 393, height: 852, x: 0, y: 0 },
              window: { width: 393, height: 852, x: 0, y: 0 },
            },
          },
        },
        pixel: {
          data: {
            platform: "android",
            safeAreaInsets: { top: 24, right: 0, bottom: 24, left: 0 },
            dimensions: {
              screen: { width: 412, height: 915, x: 0, y: 0 },
              window: { width: 412, height: 915, x: 0, y: 0 },
            },
          },
        },
      },
      render: () => (
        <Text>
          {usePlatform()}:{useDimensions("window").width}:{useSafeAreaInsets().top}
        </Text>
      ),
    });
    const defaults = defaultHostData();
    const iphone = await renderComponentToTree(withEnvironment, {
      state: "iphone",
      hostData: { ...defaults, ...withEnvironment.previews.iphone?.data },
    });
    const pixel = await renderComponentToTree(withEnvironment, {
      state: "pixel",
      hostData: { ...defaults, ...withEnvironment.previews.pixel?.data },
    });

    if (iphone.root.type !== "text" || pixel.root.type !== "text") {
      throw new Error("expected text roots");
    }
    expect(iphone.root.text).toBe("ios:393:59");
    expect(pixel.root.text).toBe("android:412:24");
    expect(iphone).not.toEqual(pixel);
  });

  it("extracts a manifest matching the definition", () => {
    const manifest = extractComponentManifest(definition);
    // Manifest v2 carries no `id` (identity is the component's file path); the
    // optional display title survives.
    expect(manifest.title).toBe("Product Option");
    expect(manifest.slot).toBe(true);
    expect(manifest.previewStates).toEqual(["default", "trial"]);
    expect(Object.keys(manifest.actions)).toEqual(["onSelect"]);
  });

  it("reports hasPanel=false and keeps it OUT of the strict manifest", () => {
    expect(definitionHasPanel(definition)).toBe(false);
    const message = describeComponent(definition);
    expect(message.hasPanel).toBe(false);
    // The manifest itself carries no `hasPanel`; it is a sibling of `manifest`
    // and the strict validator accepts the manifest as-is.
    expect("hasPanel" in message.manifest).toBe(false);
    expect(parseComponentManifest(message.manifest).ok).toBe(true);
  });

  it("reports hasPanel=true when the definition declares a panel", () => {
    const withPanel = defineComponent({
      props: (p) => ({
        accentColor: p.string().editor("color").default("#000"),
      }),
      panel: (ctx) => (
        <Panel>
          <Panel.Section title="Style">
            <Panel.PropField name="accentColor" />
          </Panel.Section>
        </Panel>
      ),
      render: () => <Text>x</Text>,
    });
    expect(definitionHasPanel(withPanel)).toBe(true);
    expect(describeComponent(withPanel).hasPanel).toBe(true);
  });
});
