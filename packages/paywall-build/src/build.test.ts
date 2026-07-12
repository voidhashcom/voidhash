import { describe, expect, it } from "vitest";
import type {
  BuildCapabilities,
  CachedManifest,
  ManifestCacheRow,
} from "./types.ts";
import {
  ALIASED_SLOT_TSX,
  HEADING_TSX,
  PAYWALL_PROPLESS_TSX,
  PAYWALL_TSX,
  PRICING_OPTION_TSX,
  PRODUCT_CARD_TSX,
  greenFork,
} from "./fixtures.ts";
import { hashSource } from "./hash.ts";
import { makeNodeCapabilities } from "./node-capabilities.ts";
import {
  buildFromFiles,
  errorsOf,
  ofPhase,
  warningsOf,
} from "./test-helpers.ts";

/** A cache backed by a plain map, recording writes for assertions. */
function makeMapCache(seed?: Map<string, CachedManifest>): {
  cache: NonNullable<BuildCapabilities["manifestCache"]>;
  recorded: ManifestCacheRow[];
} {
  const store = seed ?? new Map<string, CachedManifest>();
  const recorded: ManifestCacheRow[] = [];
  return {
    recorded,
    cache: {
      get: async (hashes) =>
        new Map(
          hashes
            .filter((h) => store.has(h))
            .map((h) => [h, store.get(h)!] as const),
        ),
      record: async (row) => {
        recorded.push(row);
        store.set(row.sourceHash, { manifest: row.manifest });
      },
    },
  };
}

describe("buildPaywall — green path", () => {
  it(
    "builds a realistic multi-file fork to ok artifacts",
    async () => {
      const result = await buildFromFiles(greenFork(), makeNodeCapabilities());

      expect(result.ok).toBe(true);
      expect(errorsOf(result)).toHaveLength(0);
      expect(result.artifacts).toBeDefined();

      const { components } = result.artifacts!;
      // Both components are ready with v2 manifests, ordered by canonical path.
      expect(components.map((c) => c.path)).toEqual([
        "components/heading.tsx",
        "components/pricing-option.tsx",
      ]);
      for (const component of components) {
        expect(component.status).toBe("ready");
        expect(component.manifest?.manifestVersion).toBe(2);
        expect(component.sourceHash).toMatch(/^[0-9a-f]{64}$/);
      }
      // The pricing-option manifest carries its declared props + action + slot.
      const pricing = components.find((c) => c.path === "components/pricing-option.tsx")!;
      expect(Object.keys(pricing.manifest!.props).sort()).toEqual([
        "highlighted",
        "label",
        "price",
      ]);
      expect(Object.keys(pricing.manifest!.actions)).toEqual(["onSelect"]);
      expect(pricing.manifest!.slot).toBe(true);
    },
    30_000,
  );

  it("stable sourceHash matches hashSource(source)", async () => {
    const result = await buildFromFiles(greenFork(), makeNodeCapabilities());
    for (const component of result.artifacts!.components) {
      expect(component.sourceHash).toBe(hashSource(component.source));
    }
  });
});

describe("buildPaywall — imports stage", () => {
  it("positions an error at a broken relative import", async () => {
    const files = {
      "/paywall.tsx": PAYWALL_TSX,
      "/components/pricing-option.tsx": PRICING_OPTION_TSX,
    };
    const result = await buildFromFiles(files, makeNodeCapabilities());
    expect(result.ok).toBe(false);

    const importErr = ofPhase(result, "imports").find((d) =>
      d.message.includes("./components/heading"),
    );
    expect(importErr).toBeDefined();
    expect(importErr!.severity).toBe("error");
    expect(importErr!.line).toBe(2);
    expect(importErr!.column).toBeGreaterThan(0);
  });

  it("rejects a subpath SDK import, positioned at the import", async () => {
    const badEntry = PAYWALL_TSX.replace(
      'import { definePaywall, Screen, View } from "@voidhash/paywalls";',
      'import { definePaywall, Screen, View } from "@voidhash/paywalls";\nimport { parseComposition } from "@voidhash/paywalls/compose";',
    );
    const result = await buildFromFiles(
      { ...greenFork(), "/paywall.tsx": badEntry },
      makeNodeCapabilities(),
    );
    const err = ofPhase(result, "imports").find((d) =>
      d.message.includes("@voidhash/paywalls/compose"),
    );
    expect(err).toBeDefined();
    expect(err!.line).toBe(2);
  });

  it("errors on a relative import FROM a component (v1)", async () => {
    const badComponent = `import { defineComponent, Text } from "@voidhash/paywalls";
import Other from "./other";
export default defineComponent({ render: () => <Text>{String(Other)}</Text> });
`;
    const result = await buildFromFiles(
      { ...greenFork(), "/components/heading.tsx": badComponent },
      makeNodeCapabilities(),
    );
    const err = ofPhase(result, "imports").find(
      (d) => d.path === "components/heading.tsx" && d.message.includes("relative"),
    );
    expect(err).toBeDefined();
    expect(err!.severity).toBe("error");
  });
});

describe("buildPaywall — typecheck stage", () => {
  it("catches a cross-file type error (number → string prop)", async () => {
    const badEntry = PAYWALL_TSX.replace('text="Unlock Pro"', "text={42}");
    const result = await buildFromFiles(
      { ...greenFork(), "/paywall.tsx": badEntry },
      makeNodeCapabilities(),
    );
    expect(result.ok).toBe(false);
    const typeErr = ofPhase(result, "types").find((d) =>
      d.message.includes("not assignable"),
    );
    expect(typeErr).toBeDefined();
    expect(typeErr!.path).toBe("/paywall.tsx");
    expect(typeErr!.line).toBeGreaterThan(0);
    expect(typeErr!.column).toBeGreaterThan(0);
  });

  it("catches a plain syntax error in a component", async () => {
    const broken = HEADING_TSX.replace("render: ({ props }) => (", "render: ({ props }) => ( <<<");
    const result = await buildFromFiles(
      { ...greenFork(), "/components/heading.tsx": broken },
      makeNodeCapabilities(),
    );
    expect(result.ok).toBe(false);
    const err = ofPhase(result, "types").find(
      (d) => d.path === "/components/heading.tsx",
    );
    expect(err).toBeDefined();
  });

  it("skips typecheck with an info diagnostic when the capability is absent", async () => {
    const caps = makeNodeCapabilities({ typecheck: false });
    const result = await buildFromFiles(greenFork(), caps);
    const info = ofPhase(result, "types").find((d) => d.severity === "info");
    expect(info).toBeDefined();
    // A number→string prop is NOT caught when typecheck is off.
    const badEntry = PAYWALL_TSX.replace('text="Unlock Pro"', "text={42}");
    const off = await buildFromFiles(
      { ...greenFork(), "/paywall.tsx": badEntry },
      caps,
    );
    expect(ofPhase(off, "types").every((d) => d.severity === "info")).toBe(true);
  });
});

describe("buildPaywall — library files", () => {
  it("builds an unimported component and includes it in artifacts", async () => {
    const extra = `import { defineComponent, Text } from "@voidhash/paywalls";
export default defineComponent({ title: "Badge", render: () => <Text>Badge</Text> });
`;
    const files = { ...greenFork(), "/components/badge.tsx": extra };
    const result = await buildFromFiles(files, makeNodeCapabilities());
    expect(result.ok).toBe(true);

    const paths = result.artifacts!.components.map((c) => c.path);
    expect(paths).toContain("components/badge.tsx");
  });
});

describe("buildPaywall — no capabilities (pure)", () => {
  it("resolves manifests statically — analyzable components reach ready without a compiler", async () => {
    // No compile/extract capability and no cache: the ONLY manifest source is
    // the static AST extractor. Both fixtures are declarative, so both resolve.
    const files = {
      "/paywall.tsx": PAYWALL_PROPLESS_TSX,
      "/components/heading.tsx": HEADING_TSX,
      "/components/pricing-option.tsx": PRICING_OPTION_TSX,
    };
    const result = await buildFromFiles(files, {});
    expect(result.ok).toBe(true);
    expect(errorsOf(result)).toHaveLength(0);
    // Both components resolve statically to ready — no degraded refs remain.
    expect(result.artifacts!.components.every((c) => c.status === "ready")).toBe(true);
    expect(result.artifacts!.components.every((c) => c.manifest !== null)).toBe(true);
    expect(warningsOf(result)).toHaveLength(0);
  });

  it("resolves manifests from a cache hit — ready without any compiler", async () => {
    // Seed the cache from a full build.
    const full = await buildFromFiles(greenFork(), makeNodeCapabilities());
    const seed = new Map<string, CachedManifest>();
    for (const c of full.artifacts!.components) {
      seed.set(c.sourceHash, { manifest: c.manifest });
    }
    const { cache } = makeMapCache(seed);

    const result = await buildFromFiles(greenFork(), { manifestCache: cache });
    expect(result.ok).toBe(true);
    expect(
      result.artifacts!.components.every((c) => c.status === "ready"),
    ).toBe(true);
  });
});

describe("buildPaywall — static extraction on a degraded runtime (stuck-agent regression)", () => {
  // The paywall the AI just authored: a fresh component, referenced with a
  // product ref, a string prop, and a boolean prop bound. On workerd there is no
  // compile/extract capability and no cache entry — static extraction is the ONLY
  // way this validates. Before the fix, the component degraded to `unknown`, its
  // props could not be validated, and the agent looped rewriting correct code.
  const FRESH_PAYWALL = `import { definePaywall, Screen, product, purchase, payload } from "@voidhash/paywalls";
import ProductCard from "./components/product-card";

export default definePaywall({
  render: () => (
    <Screen name="Main">
      <ProductCard product={product("yearly")} isSelected accentColor="#2563eb" onSelect={purchase(payload("product"))} />
    </Screen>
  ),
});
`;
  const freshFork = (): Record<string, string> => ({
    "/paywall.tsx": FRESH_PAYWALL,
    "/components/product-card.tsx": PRODUCT_CARD_TSX,
  });

  it("builds a fresh component to ready with EMPTY capabilities, props validated", async () => {
    const result = await buildFromFiles(freshFork(), {});
    expect(result.ok).toBe(true);
    expect(errorsOf(result)).toHaveLength(0);
    expect(warningsOf(result)).toHaveLength(0);

    const card = result.artifacts!.components.find(
      (c) => c.path === "components/product-card.tsx",
    )!;
    expect(card.status).toBe("ready");
    expect(card.manifest?.manifestVersion).toBe(2);
    expect(Object.keys(card.manifest!.props).sort()).toEqual([
      "accentColor",
      "isSelected",
      "product",
    ]);
    expect(card.manifest!.props.product).toMatchObject({ kind: "ref", refType: "product" });
    expect(Object.keys(card.manifest!.actions)).toEqual(["onSelect"]);
    expect(card.manifest!.slot).toBe(true);
  });

  it("still rejects the dual-export component form with the improved validate message", async () => {
    // The exact rejected form our AI was previously (wrongly) guided to write.
    const dualExport = `import { defineComponent, Text } from "@voidhash/paywalls";
export const definition = defineComponent({ title: "Card", render: () => <Text>x</Text> });
export default definition.component;
`;
    const result = await buildFromFiles(
      { ...freshFork(), "/components/product-card.tsx": dualExport },
      {},
    );
    expect(result.ok).toBe(false);
    const validateErr = ofPhase(result, "validate").find(
      (d) => d.path === "components/product-card.tsx",
    );
    expect(validateErr).toBeDefined();
    expect(validateErr!.message).toContain("export default defineComponent");
    expect(validateErr!.message).toMatch(/definition\.component/);
  });

  it("accepts children on an ALIASED-Slot component with EMPTY capabilities", async () => {
    // `Slot as S` rendered as <S/>: a source-text scan would report slot: false
    // and the parser would reject the children ("does not declare a slot") —
    // reintroducing the stuck-agent failure. Binding-resolved detection must
    // let this build succeed on the degraded runtime.
    const entry = `import { definePaywall, Screen, Text } from "@voidhash/paywalls";
import Framed from "./components/framed";

export default definePaywall({
  render: () => (
    <Screen name="Main">
      <Framed caption="Hello">
        <Text style={{ fontSize: 14 }}>Nested child</Text>
      </Framed>
    </Screen>
  ),
});
`;
    const result = await buildFromFiles(
      { "/paywall.tsx": entry, "/components/framed.tsx": ALIASED_SLOT_TSX },
      {},
    );
    expect(result.ok).toBe(true);
    expect(errorsOf(result)).toHaveLength(0);
    const framed = result.artifacts!.components.find((c) => c.path === "components/framed.tsx")!;
    expect(framed.status).toBe("ready");
    expect(framed.manifest!.slot).toBe(true);
  });
});

describe("buildPaywall — static fallback over a runtime extraction failure", () => {
  it("marks an eval-crashing (but grammatical) component ready with a non-blocking warning", async () => {
    // Module-level code throws at evaluation, so the runtime extractor fails —
    // but the defineComponent grammar is intact, so static extraction succeeds.
    // The crash must stay observable as a warning, not silently masked.
    const crashing = `import { defineComponent, Text } from "@voidhash/paywalls";

const table: Record<string, string> = {};
if (!table["missing"]) {
  throw new Error("module eval crashed");
}

export default defineComponent({
  title: "Crashy",
  props: (p) => ({
    label: p.string().default("x"),
  }),
  render: ({ props }) => <Text>{props.label}</Text>,
});
`;
    const entry = `import { definePaywall, Screen } from "@voidhash/paywalls";
import Crashy from "./components/crashy";

export default definePaywall({
  render: () => (
    <Screen name="Main">
      <Crashy label="hi" />
    </Screen>
  ),
});
`;
    const result = await buildFromFiles(
      { "/paywall.tsx": entry, "/components/crashy.tsx": crashing },
      makeNodeCapabilities(),
    );
    expect(result.ok).toBe(true);
    const crashy = result.artifacts!.components.find((c) => c.path === "components/crashy.tsx")!;
    expect(crashy.status).toBe("ready");
    expect(crashy.manifest?.title).toBe("Crashy");

    const warn = warningsOf(result).find((d) => d.message.includes("module eval crashed"));
    expect(warn).toBeDefined();
    expect(warn!.path).toBe("components/crashy.tsx");
    expect(warn!.message).toMatch(/resolved statically/i);
  });
});

describe("buildPaywall — manifest cache", () => {
  it("records freshly extracted manifests best-effort", async () => {
    const { cache, recorded } = makeMapCache();
    const caps = makeNodeCapabilities({ manifestCache: cache });
    const result = await buildFromFiles(greenFork(), caps);
    expect(result.ok).toBe(true);
    expect(recorded.map((r) => r.sourceHash).sort()).toEqual(
      result.artifacts!.components.map((c) => c.sourceHash).sort(),
    );
  });

  it("never fails the build when cache.record throws", async () => {
    const caps = makeNodeCapabilities({
      manifestCache: {
        get: async () => new Map(),
        record: async () => {
          throw new Error("cache is down");
        },
      },
    });
    const result = await buildFromFiles(greenFork(), caps);
    expect(result.ok).toBe(true);
  });
});

describe("buildPaywall — validate stage", () => {
  it("reports a missing entry as the only error", async () => {
    const result = await buildFromFiles(
      { "/components/heading.tsx": HEADING_TSX },
      makeNodeCapabilities(),
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.phase).toBe("validate");
    expect(result.diagnostics[0]!.message).toContain("does not exist");
  });

  it("flags a component that does not default-export defineComponent", async () => {
    const notAComponent = `import { Text } from "@voidhash/paywalls";
export const Heading = () => <Text>nope</Text>;
`;
    const result = await buildFromFiles(
      { ...greenFork(), "/components/heading.tsx": notAComponent },
      makeNodeCapabilities({ typecheck: false }),
    );
    const err = ofPhase(result, "validate").find((d) =>
      d.message.includes("default-export"),
    );
    expect(err).toBeDefined();
    expect(err!.path).toBe("components/heading.tsx");
  });
});

describe("buildPaywall — determinism & non-execution", () => {
  it("produces a deep-equal result on identical input", async () => {
    const caps = makeNodeCapabilities();
    const a = await buildFromFiles(greenFork(), caps);
    const b = await buildFromFiles(greenFork(), caps);
    expect(a).toEqual(b);
  });

  it("never executes the entry's module-level side effects", async () => {
    // A module-level throw would surface if the entry were ever executed by the
    // imports/typecheck stages. It must NOT — those stages only parse.
    const sideEffectEntry = `import { definePaywall, Screen } from "@voidhash/paywalls";
throw new Error("entry executed — this must never run during a build");
export default definePaywall({ render: () => <Screen /> });
`;
    // Build should complete (the syntactic stages run) and never throw the
    // module-level error. Typecheck may flag unreachable code; that is fine.
    const result = await buildFromFiles(
      { "/paywall.tsx": sideEffectEntry },
      makeNodeCapabilities({ typecheck: false }),
    );
    // No diagnostic message contains the side-effect marker.
    expect(
      result.diagnostics.some((d) => d.message.includes("entry executed")),
    ).toBe(false);
    // The syntactic stages complete without ever executing the entry.
    expect(result).toBeDefined();
  });
});
