import { describe, expect, it } from "vitest";
import { parseComponentManifest } from "@voidhash/paywalls/schema";
import {
  ALIASED_SLOT_TSX,
  HEADING_TSX,
  PRICING_OPTION_TSX,
  PRODUCT_CARD_TSX,
} from "./fixtures.ts";
import { makeNodeCapabilities } from "./node-capabilities.ts";
import { staticExtractManifest } from "./static-manifest.ts";
import type { ExtractOutcome } from "./types.ts";

/** A slot-bearing component using a namespace SDK import (`<P.Slot/>`). */
const NAMESPACE_SLOT_TSX = `import { defineComponent, View } from "@voidhash/paywalls";
import * as P from "@voidhash/paywalls";

export default defineComponent({
  title: "Namespaced",
  render: () => (
    <View>
      <P.Slot />
    </View>
  ),
});
`;

/** A component with `.localizable()` string and image props (parity fixture). */
const LOCALIZABLE_TSX = `import { defineComponent, Text } from "@voidhash/paywalls";

export default defineComponent({
  title: "Localizable",
  props: (p) => ({
    headline: p.string().default("Hi").localizable(),
    hero: p.image().localizable(),
    subtitle: p.string(),
  }),
  render: ({ props }) => <Text>{props.headline}</Text>,
});
`;

/** Extract a manifest, asserting success and returning the raw manifest value. */
function manifestOf(source: string): Record<string, unknown> {
  const outcome = staticExtractManifest(source);
  if ("diagnostics" in outcome) {
    throw new Error(
      `expected a manifest, got diagnostics: ${outcome.diagnostics.map((d) => d.message).join("; ")}`,
    );
  }
  const parsed = parseComponentManifest(outcome.manifest);
  expect(parsed.ok).toBe(true);
  return outcome.manifest as Record<string, unknown>;
}

/**
 * Extract a manifest asserting success, WITHOUT the `parseComponentManifest`
 * gate — for assertions about the static extractor's own output shape. Parity
 * with the runtime extractor is covered by the differential suite below.
 */
function extractManifestOf(source: string): Record<string, unknown> {
  const outcome = staticExtractManifest(source);
  if ("diagnostics" in outcome) {
    throw new Error(
      `expected a manifest, got diagnostics: ${outcome.diagnostics.map((d) => d.message).join("; ")}`,
    );
  }
  return outcome.manifest as Record<string, unknown>;
}

/** Assert the outcome degraded with a diagnostic matching `pattern`. */
function expectDiagnostic(outcome: ExtractOutcome, pattern: RegExp): void {
  if (!("diagnostics" in outcome)) {
    throw new Error("expected diagnostics, got a manifest");
  }
  expect(outcome.diagnostics.length).toBeGreaterThan(0);
  expect(outcome.diagnostics.some((d) => pattern.test(d.message))).toBe(true);
}

/** Wrap a `props`/`actions` body in a minimal component source. */
function componentWith(fields: string): string {
  return `import { defineComponent, Text, Slot } from "@voidhash/paywalls";
export default defineComponent({
${fields}
  render: ({ props }) => <Text>{String(props)}</Text>,
});
`;
}

describe("staticExtractManifest — prop kinds", () => {
  it("resolves every prop kind with correct manifest shape", () => {
    const manifest = manifestOf(
      componentWith(`  props: (p) => ({
    name: p.string(),
    n: p.number(),
    b: p.boolean(),
    sel: p.select(["a", "b"] as const),
    img: p.image(),
    prod: p.ref("product"),
    nested: p.component(),
    items: p.array(p.string()),
  }),`),
    );
    const props = manifest.props as Record<string, Record<string, unknown>>;

    expect(props.name).toEqual({ kind: "string", optional: false });
    expect(props.n).toEqual({ kind: "number", optional: false });
    expect(props.b).toEqual({ kind: "boolean", optional: false });
    expect(props.sel).toEqual({ kind: "select", options: ["a", "b"], optional: false });
    expect(props.img).toEqual({ kind: "image", optional: false });
    expect(props.prod).toEqual({ kind: "ref", refType: "product", optional: false });
    expect(props.nested).toEqual({ kind: "component", optional: false });
    expect(props.items).toEqual({ kind: "array", item: { kind: "string" }, optional: false });
  });

  it("carries array item options / refType / editor", () => {
    const manifest = manifestOf(
      componentWith(`  props: (p) => ({
    tags: p.array(p.select(["x", "y"] as const)),
    prods: p.array(p.ref("product")),
    colors: p.array(p.string().editor("color")),
  }),`),
    );
    const props = manifest.props as Record<string, Record<string, unknown>>;
    expect(props.tags).toEqual({
      kind: "array",
      item: { kind: "select", options: ["x", "y"] },
      optional: false,
    });
    expect(props.prods).toEqual({
      kind: "array",
      item: { kind: "ref", refType: "product" },
      optional: false,
    });
    expect(props.colors).toEqual({
      kind: "array",
      item: { kind: "string", editor: "color" },
      optional: false,
    });
  });
});

describe("staticExtractManifest — chained modifiers", () => {
  it("applies .label/.default/.optional/.editor", () => {
    const manifest = manifestOf(
      componentWith(`  props: (p) => ({
    title: p.string().label("Title").default("Untitled"),
    accent: p.string().editor("color").default("#16a34a"),
    maybe: p.number().optional(),
    on: p.boolean().default(true),
    count: p.number().default(3),
  }),`),
    );
    const props = manifest.props as Record<string, Record<string, unknown>>;

    // A default makes the prop optional even without .optional().
    expect(props.title).toEqual({
      kind: "string",
      label: "Title",
      default: "Untitled",
      optional: true,
    });
    expect(props.accent).toEqual({
      kind: "string",
      default: "#16a34a",
      editor: "color",
      optional: true,
    });
    expect(props.maybe).toEqual({ kind: "number", optional: true });
    expect(props.on).toEqual({ kind: "boolean", default: true, optional: true });
    expect(props.count).toEqual({ kind: "number", default: 3, optional: true });
  });

  it("marks string/image props .localizable() and omits the key otherwise", () => {
    const manifest = extractManifestOf(
      componentWith(`  props: (p) => ({
    headline: p.string().localizable(),
    hero: p.image().localizable(),
    subtitle: p.string(),
    logo: p.image(),
  }),`),
    );
    const props = manifest.props as Record<string, Record<string, unknown>>;

    expect(props.headline).toEqual({ kind: "string", localizable: true, optional: false });
    expect(props.hero).toEqual({ kind: "image", localizable: true, optional: false });
    // Non-localizable props stay byte-identical — no `localizable` key at all.
    expect(props.subtitle).toEqual({ kind: "string", optional: false });
    expect("localizable" in props.subtitle!).toBe(false);
    expect(props.logo).toEqual({ kind: "image", optional: false });
    expect("localizable" in props.logo!).toBe(false);
  });

  it("applies .localizable() regardless of chaining order", () => {
    const manifest = extractManifestOf(
      componentWith(`  props: (p) => ({
    a: p.string().label("A").default("x").localizable(),
    b: p.string().localizable().label("B").default("y"),
  }),`),
    );
    const props = manifest.props as Record<string, Record<string, unknown>>;
    expect(props.a).toEqual({
      kind: "string",
      label: "A",
      default: "x",
      localizable: true,
      optional: true,
    });
    expect(props.b).toEqual({
      kind: "string",
      label: "B",
      default: "y",
      localizable: true,
      optional: true,
    });
  });

  it("emits an array default only when it survives JSON (scalar array)", () => {
    const manifest = manifestOf(
      componentWith(`  props: (p) => ({
    items: p.array(p.string()).default(["a", "b"]),
  }),`),
    );
    const props = manifest.props as Record<string, Record<string, unknown>>;
    expect(props.items).toEqual({
      kind: "array",
      item: { kind: "string" },
      default: ["a", "b"],
      optional: true,
    });
  });
});

describe("staticExtractManifest — actions", () => {
  it("resolves payload-free and payloaded actions", () => {
    const manifest = manifestOf(
      componentWith(`  actions: (a) => ({
    onClose: a.action(),
    onSelect: a.action({ product: a.string(), qty: a.number(), flag: a.boolean() }),
  }),`),
    );
    expect(manifest.actions).toEqual({
      onClose: { payload: {} },
      onSelect: {
        payload: {
          product: { kind: "string" },
          qty: { kind: "number" },
          flag: { kind: "boolean" },
        },
      },
    });
  });
});

describe("staticExtractManifest — slot / hostData / previewStates", () => {
  it("detects a rendered <Slot/> as slot: true", () => {
    const withSlot = `import { defineComponent, View, Slot } from "@voidhash/paywalls";
export default defineComponent({ render: () => (<View><Slot /></View>) });`;
    expect(manifestOf(withSlot).slot).toBe(true);
  });

  it("reports slot: false when no <Slot/> is rendered", () => {
    const noSlot = `import { defineComponent, Text } from "@voidhash/paywalls";
export default defineComponent({ render: () => <Text>x</Text> });`;
    expect(manifestOf(noSlot).slot).toBe(false);
  });

  it("detects an ALIASED Slot import (`Slot as S` rendered as <S/>)", () => {
    expect(manifestOf(ALIASED_SLOT_TSX).slot).toBe(true);
  });

  it("detects a namespace-imported Slot (`<P.Slot/>`)", () => {
    expect(manifestOf(NAMESPACE_SLOT_TSX).slot).toBe(true);
  });

  it("ignores a 'Slot' mention in text — only real JSX usage counts", () => {
    // Deliberately stricter than the runtime's `\\bSlot\\b` source regex.
    const mention = `import { defineComponent, Text } from "@voidhash/paywalls";
export default defineComponent({ render: () => <Text>Slot machines! {"<Slot />"}</Text> });`;
    expect(manifestOf(mention).slot).toBe(false);
  });

  it("does not attribute an unrelated local named like an SDK export", () => {
    const local = `import { defineComponent, View, Text } from "@voidhash/paywalls";
const Slot = ({ children }: { children?: unknown }) => <Text>{String(children)}</Text>;
export default defineComponent({ render: () => (<View><Slot /></View>) });`;
    // `Slot` here is a local component, not the SDK import — no slot declared.
    expect(manifestOf(local).slot).toBe(false);
  });

  it("infers hostData products from a ref('product') prop", () => {
    const manifest = manifestOf(
      componentWith(`  props: (p) => ({ prod: p.ref("product") }),`),
    );
    expect(manifest.hostData).toEqual(["products"]);
  });

  it("infers hostData products from a product-reading hook in render", () => {
    const src = `import { defineComponent, Text, usePaywallProducts } from "@voidhash/paywalls";
export default defineComponent({ render: () => { const ps = usePaywallProducts(); return <Text>{ps.length}</Text>; } });`;
    expect(manifestOf(src).hostData).toEqual(["products"]);
  });

  it("reports empty hostData with no products", () => {
    const manifest = manifestOf(componentWith(`  props: (p) => ({ x: p.string() }),`));
    expect(manifest.hostData).toEqual([]);
  });

  it("defaults previewStates to ['default'] and uses declared preview names", () => {
    expect(manifestOf(componentWith(`  props: (p) => ({ x: p.string() }),`)).previewStates).toEqual([
      "default",
    ]);
    const withPreviews = `import { defineComponent, Text } from "@voidhash/paywalls";
export default defineComponent({
  previews: { compact: { props: {} }, expanded: { props: {} } },
  render: () => <Text>x</Text>,
});`;
    expect(manifestOf(withPreviews).previewStates).toEqual(["compact", "expanded"]);
  });

  it("infers hostData products from a preview declaring product data", () => {
    const src = `import { defineComponent, Text } from "@voidhash/paywalls";
export default defineComponent({
  previews: { default: { data: { products: [] } } },
  render: () => <Text>x</Text>,
});`;
    expect(manifestOf(src).hostData).toEqual(["products"]);
  });

  it("includes SHORTHAND preview state names (Object.keys parity)", () => {
    const src = `import { defineComponent, Text } from "@voidhash/paywalls";
const compact = { props: {} };
export default defineComponent({
  previews: { compact, expanded: { props: {} } },
  render: () => <Text>x</Text>,
});`;
    expect(manifestOf(src).previewStates).toEqual(["compact", "expanded"]);
  });

  it("degrades on a spread inside previews instead of under-reporting states", () => {
    const src = `import { defineComponent, Text } from "@voidhash/paywalls";
const shared = { compact: { props: {} } };
export default defineComponent({
  previews: { ...shared, expanded: { props: {} } },
  render: () => <Text>x</Text>,
});`;
    expectDiagnostic(staticExtractManifest(src), /spread.*declarative|declarative.*spread/is);
  });

  it("degrades on a computed preview state name", () => {
    const src = `import { defineComponent, Text } from "@voidhash/paywalls";
const key = "compact";
export default defineComponent({
  previews: { [key]: { props: {} } },
  render: () => <Text>x</Text>,
});`;
    expectDiagnostic(staticExtractManifest(src), /preview state name|declarative/i);
  });
});

describe("staticExtractManifest — title/description", () => {
  it("carries title and description literals", () => {
    const src = `import { defineComponent, Text } from "@voidhash/paywalls";
export default defineComponent({ title: "Hero", description: "Big banner", render: () => <Text>x</Text> });`;
    const manifest = manifestOf(src);
    expect(manifest.title).toBe("Hero");
    expect(manifest.description).toBe("Big banner");
  });
});

describe("staticExtractManifest — accepted export forms", () => {
  const body = `{ title: "X", props: (p) => ({ n: p.string() }), render: () => null }`;

  it("accepts `export default defineComponent({...})`", () => {
    const src = `import { defineComponent } from "@voidhash/paywalls";
export default defineComponent(${body});`;
    expect(manifestOf(src).title).toBe("X");
  });

  it("accepts a const bound to defineComponent, exported as default", () => {
    const src = `import { defineComponent } from "@voidhash/paywalls";
const Def = defineComponent(${body});
export default Def;`;
    expect(manifestOf(src).title).toBe("X");
  });

  it("accepts `export { X as default }`", () => {
    const src = `import { defineComponent } from "@voidhash/paywalls";
const Def = defineComponent(${body});
export { Def as default };`;
    expect(manifestOf(src).title).toBe("X");
  });

  it("unwraps an `as`-cast around the call", () => {
    const src = `import { defineComponent } from "@voidhash/paywalls";
export default defineComponent(${body}) as unknown;`;
    expect(manifestOf(src).title).toBe("X");
  });
});

describe("staticExtractManifest — degradation cases", () => {
  it("degrades when there is no default export", () => {
    const src = `import { defineComponent } from "@voidhash/paywalls";
export const Def = defineComponent({ render: () => null });`;
    expectDiagnostic(staticExtractManifest(src), /default-export|defineComponent/i);
  });

  it("rejects the dual-export component form (export default definition.component)", () => {
    const src = `import { defineComponent } from "@voidhash/paywalls";
export const definition = defineComponent({ render: () => null });
export default definition.component;`;
    expectDiagnostic(staticExtractManifest(src), /default-export|defineComponent/i);
  });

  it("degrades on a non-literal default value", () => {
    const some = "const FALLBACK = compute();";
    const src = `import { defineComponent, Text } from "@voidhash/paywalls";
${some}
export default defineComponent({ props: (p) => ({ t: p.string().default(FALLBACK) }), render: () => <Text>x</Text> });`;
    expectDiagnostic(staticExtractManifest(src), /literal|declarative/i);
  });

  it("degrades on a spread inside the props object", () => {
    const src = `import { defineComponent, Text } from "@voidhash/paywalls";
const shared = {};
export default defineComponent({ props: (p) => ({ ...shared, t: p.string() }), render: () => <Text>x</Text> });`;
    expectDiagnostic(staticExtractManifest(src), /declarative|assignment/i);
  });

  it("degrades on a non-arrow props function", () => {
    const src = `import { defineComponent, Text } from "@voidhash/paywalls";
function makeProps(p) { return { t: p.string() }; }
export default defineComponent({ props: makeProps, render: () => <Text>x</Text> });`;
    expectDiagnostic(staticExtractManifest(src), /arrow|declarative/i);
  });

  it("degrades on a computed prop name", () => {
    const src = `import { defineComponent, Text } from "@voidhash/paywalls";
const key = "t";
export default defineComponent({ props: (p) => ({ [key]: p.string() }), render: () => <Text>x</Text> });`;
    expectDiagnostic(staticExtractManifest(src), /identifier|declarative/i);
  });

  it("rejects a prop literally named 'id'", () => {
    const src = componentWith(`  props: (p) => ({ id: p.string() }),`);
    expectDiagnostic(staticExtractManifest(src), /"id" is reserved/i);
  });

  it("rejects an empty select options list", () => {
    const src = componentWith(`  props: (p) => ({ sel: p.select([] as const) }),`);
    expectDiagnostic(staticExtractManifest(src), /options/i);
  });

  it("degrades on .localizable() applied to a non-string/image kind", () => {
    const src = componentWith(`  props: (p) => ({ n: p.number().localizable() }),`);
    expectDiagnostic(staticExtractManifest(src), /localizable.*string.*image|only valid on/i);
  });

  it("degrades on .localizable() called with an argument", () => {
    const src = componentWith(`  props: (p) => ({ t: p.string().localizable(true) }),`);
    expectDiagnostic(staticExtractManifest(src), /localizable.*no arguments/i);
  });
});

describe("staticExtractManifest — differential vs runtime extractor", () => {
  // The runtime extractor is the ground truth: compile via the Node capability,
  // then evaluate + extractComponentManifest. The static manifest MUST deep-equal
  // it for any statically-analyzable definition.
  const caps = makeNodeCapabilities();

  const runtimeManifest = async (source: string): Promise<unknown> => {
    const outcome = await caps.compile!(source);
    if ("diagnostics" in outcome) {
      throw new Error(`compile failed: ${outcome.diagnostics.map((d) => d.message).join("; ")}`);
    }
    const extracted = await caps.extractManifest!(outcome.code);
    if ("diagnostics" in extracted) {
      throw new Error(`extract failed: ${extracted.diagnostics.map((d) => d.message).join("; ")}`);
    }
    return extracted.manifest;
  };

  const cases: Array<[string, string]> = [
    ["PRICING_OPTION_TSX", PRICING_OPTION_TSX],
    ["HEADING_TSX", HEADING_TSX],
    ["PRODUCT_CARD_TSX", PRODUCT_CARD_TSX],
    ["ALIASED_SLOT_TSX", ALIASED_SLOT_TSX],
    ["NAMESPACE_SLOT_TSX", NAMESPACE_SLOT_TSX],
    ["LOCALIZABLE_TSX", LOCALIZABLE_TSX],
  ];

  for (const [name, source] of cases) {
    it(`static manifest deep-equals the runtime manifest for ${name}`, async () => {
      const runtime = await runtimeManifest(source);
      const outcome = staticExtractManifest(source);
      expect("manifest" in outcome).toBe(true);
      const staticManifest = (outcome as { manifest: unknown }).manifest;
      // Round-trip through JSON to normalize key order for a structural compare.
      expect(JSON.parse(JSON.stringify(staticManifest))).toEqual(
        JSON.parse(JSON.stringify(runtime)),
      );
    });
  }

  it("both extractors report slot: true for the aliased-Slot component", async () => {
    // The compiled alias is rewritten back to `.Slot`, so the runtime detects it;
    // static must agree via import-binding resolution.
    const runtime = (await runtimeManifest(ALIASED_SLOT_TSX)) as { slot: boolean };
    const outcome = staticExtractManifest(ALIASED_SLOT_TSX) as { manifest: { slot: boolean } };
    expect(runtime.slot).toBe(true);
    expect(outcome.manifest.slot).toBe(true);
  });
});
