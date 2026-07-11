import { describe, expect, test } from "vite-plus/test";
import ts from "typescript";

/**
 * De-risking regression test for the multi-file paywall code editor.
 *
 * We are moving the paywall code editor from a single ambient buffer to a file
 * tree where `paywall.tsx` imports sibling component files by RELATIVE PATH
 * (e.g. `import PricingOption from "./components/pricing-option"`), each edited
 * as its own Monaco model. The load-bearing assumption we must prove BEFORE
 * building on it: the TypeScript module resolution that Monaco's TS worker
 * performs over its in-memory file host resolves relative imports between
 * sibling virtual files keyed by `file:///` URIs — both extensionless and
 * `.tsx`-suffixed — under the compiler options we ship.
 *
 * WHY THIS IS A FAITHFUL MIRROR OF MONACO'S WORKER
 * ------------------------------------------------
 * monaco-editor@0.52.2 embeds TypeScript 5.4.5 and, inside its
 * `ts.worker.js`, stands up a real `ts.createLanguageService(host)` where the
 * host's file universe is `models ∪ extraLibs`:
 *   - open models (our per-buffer `file:///<key>.tsx` script files) are the
 *     ROOT files returned from `getScriptFileNames`;
 *   - `addExtraLib(...)` files are NOT root files but ARE consulted by the
 *     host's `fileExists` / `readFile` / `getScriptSnapshot`.
 * Module resolution is delegated to the embedded TS compiler's default Node
 * resolver, which probes the host via `fileExists`/`readFile`. This test
 * reconstructs exactly that host shape in Node and asserts the resolver's
 * diagnostics, so a green run here means the real worker resolves the same way.
 *
 * CAVEAT ON TS VERSION: this test links the workspace `typescript` (currently
 * 6.0.3) rather than the 5.4.5 that Monaco bundles. Node10 relative resolution
 * and `allowImportingTsExtensions` (TS >= 5.0) are stable across that range, so
 * a newer compiler is a strictly-stronger check of the same behavior. If a
 * future Monaco bump changes its embedded compiler, this test still guards the
 * resolution contract we depend on.
 */

/**
 * Compiler options mirroring today's Monaco setup in `code-editor-pane.tsx`
 * (`typescriptDefaults.setCompilerOptions`), PLUS the two options the multi-file
 * design adds: `allowImportingTsExtensions` (so `./x.tsx` imports are legal) and
 * `noEmit` (already set today, restated here as the resolution config requires
 * it alongside `allowImportingTsExtensions`).
 *
 * The enum numeric values are pinned to what Monaco's `ts.languages.typescript`
 * enums produce (verified against TS 6.0.3): JsxEmit.ReactJSX=4, ModuleKind
 * .ESNext=99, ModuleResolutionKind.NodeJs=2 (classic "node10"), ScriptTarget
 * .ES2020=7. We reference `ts.*` directly so the test tracks the linked
 * compiler's enums rather than hard-coding integers.
 */
const COMPILER_OPTIONS: ts.CompilerOptions = {
  allowNonTsExtensions: true,
  esModuleInterop: true,
  jsx: ts.JsxEmit.ReactJSX,
  jsxImportSource: "@voidhash/paywalls",
  module: ts.ModuleKind.ESNext,
  // Monaco's `ModuleResolutionKind.NodeJs` === TS `NodeJs` (classic node10).
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  noEmit: true,
  strict: true,
  target: ts.ScriptTarget.ES2020,
  // The two additions the multi-file design relies on:
  allowImportingTsExtensions: true,
};

/**
 * Minimal ambient `.d.ts` mimicking the shape `@voidhash/paywalls` exposes via
 * `jsxImportSource` + the sandbox d.ts, WITHOUT depending on the real package.
 * It gives JSX a valid runtime and a `Component` type the sibling files export,
 * so the only thing that can produce TS2307 is a failed module resolution — not
 * a missing JSX runtime or a missing React-like type.
 */
const PAYWALLS_AMBIENT_DTS = `
declare module "@voidhash/paywalls/jsx-runtime" {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}
declare module "@voidhash/paywalls" {
  export interface ComponentProps {
    label?: string;
  }
  export type Component = (props: ComponentProps) => unknown;
}
declare namespace JSX {
  interface Element {}
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
`;

/** A sibling component file, default-exporting a typed React-like component. */
const PRICING_OPTION_TSX = `
import type { Component } from "@voidhash/paywalls";

const PricingOption: Component = ({ label }) => <text>{label}</text>;

export default PricingOption;
`;

const HERO_TSX = `
import type { Component } from "@voidhash/paywalls";

const Hero: Component = ({ label }) => <view>{label}</view>;

export default Hero;
`;

/**
 * The composition buffer. Imports one sibling EXTENSIONLESS and the other with
 * an explicit `.tsx` suffix, uses both in JSX, and default-exports an object —
 * matching the printed form the multi-file editor will emit.
 */
const PAYWALL_TSX = `
import PricingOption from "./components/pricing-option";
import Hero from "./components/hero.tsx";

const Paywall = () => (
  <view>
    <Hero label="Welcome" />
    <PricingOption label="Pro" />
  </view>
);

export default { root: Paywall };
`;

/** URIs mirror the app's `file:///<key>.tsx` model scheme. */
const PAYWALL_URI = "file:///paywall.tsx";
const PRICING_OPTION_URI = "file:///components/pricing-option.tsx";
const HERO_URI = "file:///components/hero.tsx";
const AMBIENT_URI = "file:///paywalls-sandbox.d.ts";

interface HostFile {
  content: string;
  /**
   * Root files === Monaco open models (returned by `getScriptFileNames`).
   * Non-root files === `addExtraLib` files (present to `fileExists`/`readFile`
   * but not enumerated as root files). This is the exact distinction the worker
   * host draws between `_models` and `_extraLibs`.
   */
  root: boolean;
}

/**
 * Build a `ts.LanguageService` over an in-memory host shaped like Monaco's TS
 * worker host. This deliberately mirrors the EXACT method surface the worker's
 * `TypeScriptWorker` class implements (verified against monaco 0.52.2's
 * `ts.worker.js`): only
 *   getCompilationSettings, getScriptFileNames, getScriptVersion,
 *   getScriptSnapshot, getCurrentDirectory, getDefaultLibFileName,
 *   fileExists, readFile
 * are provided. It notably does NOT implement `directoryExists`,
 * `getDirectories`, or `readDirectory`.
 *
 * That omission is load-bearing: if the host DID delegate `directoryExists` to
 * the real filesystem (`ts.sys.directoryExists`), TS's Node resolver would ask
 * whether `/components` exists on disk, get `false`, and refuse to probe our
 * virtual `file:///components/*.tsx` siblings — yielding spurious TS2307. By
 * omitting directory methods (as the worker does), TS falls back to
 * `fileExists`-only probing over the in-memory file set, which is what actually
 * happens in the editor. `getScriptFileNames` returns only ROOT files (open
 * models); `fileExists`/`readFile`/`getScriptSnapshot` consult the FULL set
 * (models + extra libs), with a real-FS fallback used ONLY to serve the
 * compiler's default lib — exactly as the worker serves its bundled libs.
 */
function createLanguageService(files: Map<string, HostFile>): ts.LanguageService {
  const defaultLibFileName = ts.getDefaultLibFilePath(COMPILER_OPTIONS);

  const has = (fileName: string): boolean => files.has(fileName) || ts.sys.fileExists(fileName);
  const read = (fileName: string): string | undefined => {
    const local = files.get(fileName);
    if (local) {
      return local.content;
    }
    return ts.sys.readFile(fileName);
  };

  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => COMPILER_OPTIONS,
    // Root files only — mirrors `getScriptFileNames` returning open models.
    getScriptFileNames: () =>
      [...files.entries()].filter(([, file]) => file.root).map(([name]) => name),
    getScriptVersion: () => "1",
    getScriptSnapshot: (fileName) => {
      const content = read(fileName);
      return content === undefined ? undefined : ts.ScriptSnapshot.fromString(content);
    },
    getCurrentDirectory: () => "/",
    getDefaultLibFileName: () => defaultLibFileName,
    fileExists: has,
    readFile: read,
    // Intentionally NO directoryExists / getDirectories / readDirectory — see
    // the doc comment above. This matches the worker's host surface exactly.
  };

  return ts.createLanguageService(host, ts.createDocumentRegistry());
}

/** Collect semantic + syntactic diagnostics for a file as `{code, message}`. */
function diagnosticsFor(service: ts.LanguageService, fileName: string) {
  return [
    ...service.getSemanticDiagnostics(fileName),
    ...service.getSyntacticDiagnostics(fileName),
  ].map((diagnostic) => ({
    code: diagnostic.code,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
  }));
}

/** TS2307 is "Cannot find module '...'" — the resolution failure we guard against. */
const CANNOT_FIND_MODULE = 2307;

describe("Monaco TS worker module resolution (paywall multi-file spike)", () => {
  test("resolves extensionless AND .tsx-suffixed sibling imports when siblings are root models", () => {
    const files = new Map<string, HostFile>([
      [AMBIENT_URI, { content: PAYWALLS_AMBIENT_DTS, root: false }],
      [PAYWALL_URI, { content: PAYWALL_TSX, root: true }],
      [PRICING_OPTION_URI, { content: PRICING_OPTION_TSX, root: true }],
      [HERO_URI, { content: HERO_TSX, root: true }],
    ]);

    const service = createLanguageService(files);
    const diagnostics = diagnosticsFor(service, PAYWALL_URI);
    const moduleErrors = diagnostics.filter((d) => d.code === CANNOT_FIND_MODULE);

    // Both `./components/pricing-option` (extensionless) and
    // `./components/hero.tsx` (.tsx-suffixed) must resolve → zero TS2307.
    expect(moduleErrors).toEqual([]);
  });

  test("resolves sibling imports when siblings are EXTRA LIBS (non-root), not open models", () => {
    // Only the composition buffer is a root model; the components are provided
    // the way `addExtraLib` provides files — present to the host's fileExists /
    // readFile but NOT enumerated as root files. This is the case where a
    // component file is closed in the editor but still referenced.
    const files = new Map<string, HostFile>([
      [AMBIENT_URI, { content: PAYWALLS_AMBIENT_DTS, root: false }],
      [PAYWALL_URI, { content: PAYWALL_TSX, root: true }],
      [PRICING_OPTION_URI, { content: PRICING_OPTION_TSX, root: false }],
      [HERO_URI, { content: HERO_TSX, root: false }],
    ]);

    const service = createLanguageService(files);
    const diagnostics = diagnosticsFor(service, PAYWALL_URI);
    const moduleErrors = diagnostics.filter((d) => d.code === CANNOT_FIND_MODULE);

    expect(moduleErrors).toEqual([]);
  });

  test("a broken relative import DOES produce TS2307 (guards against a vacuous pass)", () => {
    const brokenPaywall = `
import Missing from "./components/does-not-exist";

const Paywall = () => <view><Missing /></view>;

export default { root: Paywall };
`;
    const files = new Map<string, HostFile>([
      [AMBIENT_URI, { content: PAYWALLS_AMBIENT_DTS, root: false }],
      [PAYWALL_URI, { content: brokenPaywall, root: true }],
      [PRICING_OPTION_URI, { content: PRICING_OPTION_TSX, root: true }],
      [HERO_URI, { content: HERO_TSX, root: true }],
    ]);

    const service = createLanguageService(files);
    const diagnostics = diagnosticsFor(service, PAYWALL_URI);
    const moduleErrors = diagnostics.filter((d) => d.code === CANNOT_FIND_MODULE);

    expect(moduleErrors.length).toBeGreaterThan(0);
    expect(moduleErrors[0].message).toContain("./components/does-not-exist");
  });

  test("the resolved sibling's default export TYPE flows through (not just name resolution)", () => {
    // Passing a prop of the wrong type to an imported component must surface a
    // type error — proving resolution returns the real module's types, so
    // downstream editor features (hover, completions) work across files.
    const typoPaywall = `
import PricingOption from "./components/pricing-option";

// \`label\` is \`string | undefined\`; a number must be a type error.
const Paywall = () => <PricingOption label={123} />;

export default { root: Paywall };
`;
    const files = new Map<string, HostFile>([
      [AMBIENT_URI, { content: PAYWALLS_AMBIENT_DTS, root: false }],
      [PAYWALL_URI, { content: typoPaywall, root: true }],
      [PRICING_OPTION_URI, { content: PRICING_OPTION_TSX, root: true }],
    ]);

    const service = createLanguageService(files);
    const diagnostics = diagnosticsFor(service, PAYWALL_URI);

    // No resolution failure...
    expect(diagnostics.filter((d) => d.code === CANNOT_FIND_MODULE)).toEqual([]);
    // ...but the cross-file type IS enforced (some type-mismatch diagnostic).
    expect(diagnostics.length).toBeGreaterThan(0);
  });
});
