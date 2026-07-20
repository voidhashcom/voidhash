import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { describe, expect, it } from "vitest";

import { parseComponentManifest, parsePreviewTree } from "../src/schema/validate";

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const bundleModule = path.join(distDir, "sandbox-bundle.mjs");
const dtsModule = path.join(distDir, "sandbox-dts.mjs");

// These tests exercise the *built* IIFE + generated dts, so they only run after
// `pnpm build`. Skipped (not failed) when dist is absent so `vitest` alone
// stays green; the gate runs build first.
const built = existsSync(bundleModule) && existsSync(dtsModule);
const describeBuilt = built ? describe : describe.skip;

const SOURCE = `import { defineComponent, View, Text, Pressable, Slot, usePaywallProducts, usePlatform, useSafeAreaInsets, useDimensions, useState, useEffect } from "@voidhash/paywalls";

export default defineComponent({
  props: (p) => ({
    accentColor: p.string().editor("color").default("#16a34a"),
  }),
  actions: (a) => ({ onSelect: a.action({ productId: a.string() }) }),
  previews: { default: {}, trial: {} },
  render: ({ props, actions }) => {
    const products = usePaywallProducts();
    const platform = usePlatform();
    const insets = useSafeAreaInsets();
    const windowDimensions = useDimensions("window");
    const product = products[0];
    const [n, setN] = useState(0);
    useEffect(() => { setN(1); }, []);
    return (
      <Pressable onPress={actions.onSelect} style={{ paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16, backgroundColor: props.accentColor }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: "white" }}>{product.displayName} {n} {platform} {windowDimensions.width} {insets.top}</Text>
        </View>
        <Slot />
      </Pressable>
    );
  },
});
`;

interface SandboxSurface {
  modules: Record<string, unknown>;
  extractComponentManifest: (definition: unknown) => unknown;
  renderComponentToTree: (
    definition: unknown,
    inputs: {
      state: string;
      props?: Record<string, unknown>;
      hostData?: unknown;
    },
  ) => Promise<unknown>;
  defaultHostData: () => unknown;
}

describeBuilt("sandbox IIFE (node integration, mirrors the studio sandbox path)", () => {
  it("evals the bundle, runs compiled CJS through the require shim, renders valid trees", async () => {
    const { sandboxRuntimeBundle, SANDBOX_GLOBAL_NAME } = (await import(bundleModule)) as {
      sandboxRuntimeBundle: string;
      SANDBOX_GLOBAL_NAME: string;
    };

    // Eval the IIFE into a fresh global, exactly like the iframe bootstrap.
    const globalObject = globalThis as Record<string, unknown>;
    // biome-ignore lint/security/noGlobalEval: exercising the sandbox's eval path
    (0, eval)(sandboxRuntimeBundle);
    const sandbox = globalObject[SANDBOX_GLOBAL_NAME] as SandboxSurface;
    expect(sandbox).toBeDefined();
    expect(typeof sandbox.renderComponentToTree).toBe("function");

    const compiled = await esbuild.transform(SOURCE, {
      format: "cjs",
      jsx: "automatic",
      jsxImportSource: "@voidhash/paywalls",
      loader: "tsx",
      target: "es2022",
    });

    // The require shim the studio installs: every author-importable specifier
    // maps onto a sub-object of the sandbox global's `modules`.
    const requireShim = (specifier: string): unknown => {
      const mod = sandbox.modules[specifier];
      if (mod === undefined) {
        throw new Error(`unmapped module "${specifier}"`);
      }
      return mod;
    };
    const moduleObj = { exports: {} as Record<string, unknown> };
    // biome-ignore lint/security/noGlobalEval: executing our own compiled fixture
    new Function("require", "module", "exports", compiled.code)(
      requireShim,
      moduleObj,
      moduleObj.exports,
    );
    const definition = moduleObj.exports.default ?? moduleObj.exports.definition;
    expect(definition).toBeDefined();

    const manifest = sandbox.extractComponentManifest(definition);
    expect(parseComponentManifest(manifest).ok).toBe(true);

    const hostData = sandbox.defaultHostData();
    const tree = await sandbox.renderComponentToTree(definition, {
      hostData,
      state: "default",
    });
    const parsed = parsePreviewTree(tree);
    expect(parsed.ok).toBe(true);
    // Products + settled effect both flowed through the real reconciler.
    expect(JSON.stringify(tree)).toContain("Yearly 1 ios 393 59");
  });
});

describeBuilt("generated Monaco dts", () => {
  it("is a self-contained ambient module with the key author identifiers", async () => {
    const { sandboxDts } = (await import(dtsModule)) as { sandboxDts: string };
    expect(sandboxDts).toContain('declare module "@voidhash/paywalls"');
    // The ONE root module now covers BOTH file kinds: component authoring
    // (defineComponent + primitives + hooks) and paywall composition
    // (definePaywall + Screen + variable + the compose helpers).
    for (const identifier of [
      "defineComponent",
      "definePaywall",
      "Screen",
      "variable",
      "usePlatform",
      "useSafeAreaInsets",
      "useDimensions",
      "PaywallSafeAreaInsets",
      "PaywallDimensions",
      "PaywallDimensionTarget",
      "useState",
      "View",
      "Slot",
      "Pressable",
      "Text",
    ]) {
      expect(sandboxDts).toContain(identifier);
    }
    // The react imports must have been stripped (self-contained ambient module).
    expect(sandboxDts).not.toMatch(/from ["']react["']/);
  });
});
