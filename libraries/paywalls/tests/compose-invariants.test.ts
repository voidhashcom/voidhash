import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, test } from "vitest";

import { generateComposeDts, parseComposition, printComposition } from "../src/compose/index";

const COMPOSE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/compose");

/**
 * Part 1a — the parser keys off JSX tag names and call identifiers, NOT imports
 * (it ignores import declarations entirely). So a `.paywall.tsx` importing the
 * tags from the package ROOT, or from nowhere at all, must parse to the exact
 * same AST as the canonical `@voidhash/paywalls/compose` header — and all three
 * print back the one normalized compose header (the printer regenerates it
 * one-way regardless of what the author wrote).
 */
describe("import-agnostic parse (printer normalizes headers one-way)", () => {
  const BODY = `
export default paywall(() => {
  const selected = variable.product("selectedProduct");
  return (
    <Screen name="Main" style={{ backgroundColor: "rgba(10, 10, 20, 1)" }}>
      <View name="CTA" onPress={purchase(selected)}>
        <Text style={{ fontSize: 18 }}>Continue</Text>
      </View>
    </Screen>
  );
});`;

  const CANONICAL_HEADER = `import { paywall, Screen, View, Text, variable, product, purchase } from "@voidhash/paywalls/compose";`;
  const ROOT_HEADER = `import { paywall, Screen, View, Text, variable, product, purchase } from "@voidhash/paywalls";`;

  test("root-package import and no import at all parse identically to the compose header", () => {
    const fromCompose = parseComposition(`${CANONICAL_HEADER}\n${BODY}`);
    const fromRoot = parseComposition(`${ROOT_HEADER}\n${BODY}`);
    const fromNothing = parseComposition(BODY);
    expect(fromRoot).toEqual(fromCompose);
    expect(fromNothing).toEqual(fromCompose);
  });

  test("all three print back the canonical @voidhash/paywalls/compose header", () => {
    const printedFromRoot = printComposition(parseComposition(`${ROOT_HEADER}\n${BODY}`));
    const printedFromNothing = printComposition(parseComposition(BODY));
    const header = 'from "@voidhash/paywalls/compose"';
    expect(printedFromRoot.split("\n")[0]).toContain(header);
    expect(printedFromNothing.split("\n")[0]).toContain(header);
    // Neither may leak the package-root specifier the author wrote.
    expect(printedFromRoot.split("\n")[0]).not.toMatch(/from "@voidhash\/paywalls"\s*;/);
  });
});

/**
 * Part 1b — the generated ambient d.ts and the real author surface are derived
 * from the same registry descriptors (tags) or mirror the same source (helpers),
 * so every symbol `author-surface.ts` exports must appear in the generated
 * module. This catches a symbol added to the surface but not the d.ts.
 */
describe("generateComposeDts ↔ author-surface sync", () => {
  /**
   * Symbols DECLARED in the generated ambient module that are intentionally NOT
   * author-surface exports, so the reverse (dts → surface) direction below does
   * not spuriously fail. Keep this minimal — each entry needs a reason.
   */
  const DTS_ONLY = new Set([
    // Internal `type Node = unknown;` alias, unexported on both sides.
    "Node",
    // Structured background value shapes inlined into the ambient module (Monaco
    // can't reach the package-internal `./style-attr-types` import); on the real
    // surface these live in that type-only module, not as named surface exports.
    "StyleGradientValue",
    "StyleImageValue",
  ]);

  test("every author-surface export appears in the generated module", () => {
    const surface = readFileSync(path.join(COMPOSE_DIR, "author-surface.ts"), "utf8");
    const dts = generateComposeDts();
    const exported = surfaceExportNames(surface);
    // Sanity: the surface really does export the symbols we expect to check.
    expect(exported).toEqual(
      expect.arrayContaining([
        "VariableHandle",
        "ProductRef",
        "Action",
        "paywall",
        "Screen",
        "View",
        "Text",
        "variable",
        "product",
        "purchase",
        "closePaywall",
        "none",
        "payload",
      ]),
    );
    for (const name of exported) {
      // Word-boundary match so a symbol isn't spuriously "found" as a substring
      // of a longer identifier (e.g. `product` inside `ProductRef`).
      const found = new RegExp(`\\b${name}\\b`).test(dts);
      expect(found, `generated dts is missing author-surface symbol "${name}"`).toBe(true);
    }
  });

  test("every symbol declared in the generated module is an author-surface export", () => {
    const surface = readFileSync(path.join(COMPOSE_DIR, "author-surface.ts"), "utf8");
    const dts = generateComposeDts();
    const surfaceExports = new Set(surfaceExportNames(surface));
    for (const name of declaredNames(dts)) {
      if (DTS_ONLY.has(name)) continue;
      expect(
        surfaceExports.has(name),
        `generated dts declares "${name}" but the author surface does not export it ` +
          `(add it to author-surface.ts, or to DTS_ONLY with a reason if generated-only)`,
      ).toBe(true);
    }
  });

  test("the generated built-in tags carry precise (non-loose) prop types", () => {
    const dts = generateComposeDts();
    // The old loose surface typed tags as `(props: Record<string, unknown>)`.
    expect(dts).not.toContain("Record<string, unknown>");
    // A representative descriptor-derived signature is present.
    expect(dts).toContain(`flexDirection?: "row" | "column";`);
    expect(dts).toContain(`gap?: number;`);
    expect(dts).toContain(`onPress?: Action;`);
    expect(dts).toContain(`backgroundGradient?: StyleGradientValue;`);
  });
});

/**
 * Part 1c — the compose module graph must never pull in react or the runtime
 * primitives; it is a mimic/react-free authoring + serialization surface. A
 * source-level import scan (robust to comments and strings via the TS scanner)
 * asserts no `src/compose/**` file imports a forbidden specifier.
 */
describe("compose graph is react/runtime-free", () => {
  const FORBIDDEN = [
    "react",
    "react-dom",
    "react-reconciler",
    "../primitives",
    "../jsx-runtime",
    "../renderer",
    "../tree-renderer",
    "../style",
  ];

  test("no src/compose file imports react / primitives / runtime", () => {
    for (const file of composeSourceFiles()) {
      const specifiers = importSpecifiers(readFileSync(file, "utf8"), file);
      for (const specifier of specifiers) {
        for (const forbidden of FORBIDDEN) {
          // Every forbidden entry is banned both exactly and as a path prefix, so
          // a deep import (`../style/resolve`, `react-dom/client`, …) is caught,
          // not just the bare specifier.
          const hit = specifier === forbidden || specifier.startsWith(`${forbidden}/`);
          expect(hit, `${path.basename(file)} imports forbidden "${specifier}"`).toBe(false);
        }
      }
    }
  });
});

/**
 * Part 2 (substance) — the generated ambient d.ts actually rejects unknown style
 * keys and wrong-typed values, and accepts a well-typed composition. Style fields
 * are nested under `style`; `name`/`onPress`/children are siblings. We exercise the
 * generated declarations as plain calls (`Screen({...})`) so the check is about the
 * prop object type, free of JSX-factory plumbing.
 */
describe("generated dts type-checks the style={{ … }} surface", () => {
  const dts = generateComposeDts();

  // Each case spins up a full in-process `ts.createProgram`, which is slow (~2s
  // solo) and can exceed vitest's 5s default under concurrent scheduling in the
  // full suite; a generous explicit timeout keeps them robust to that.
  const TYPECHECK_TIMEOUT = 30_000;

  test(
    "a well-typed composition surface compiles clean",
    () => {
      const good = `
import { Screen, View, Text, variable, purchase } from "@voidhash/paywalls/compose";
const p = variable.product("p");
Screen({ style: { backgroundColor: "rgba(0,0,0,1)", gap: 8, flexDirection: "column", safeAreaTop: true } });
View({ onPress: purchase(p), style: { width: "auto", opacity: 0.5, backgroundType: "gradient",
  backgroundGradient: { kind: "linear", startX: 0, startY: 0, endX: 1, endY: 1, stops: [{ color: "rgba(0,0,0,1)", position: 0 }] } } });
Text({ style: { fontSize: 16, textAlign: "center", fontWeight: "700" }, children: "Hi" });
`;
      expect(typeCheck(dts, good)).toEqual([]);
    },
    TYPECHECK_TIMEOUT,
  );

  test(
    "a style-key typo and wrong-typed values inside style error",
    () => {
      const bad = `
import { View, Text } from "@voidhash/paywalls/compose";
View({ style: { paddingTp: 4 } });
View({ style: { flexDirection: "diagonal" } });
View({ style: { gap: "lots" } });
View({ onPress: "nope" });
Text({ style: { fontSze: 9 } });
`;
      const messages = typeCheck(dts, bad);
      expect(messages.some((m) => /paddingTp/.test(m) && /paddingTop/.test(m))).toBe(true);
      // Enum-union member order is TS-version-dependent; match order-agnostically.
      expect(
        messages.some((m) => /"diagonal"/.test(m) && /"row"/.test(m) && /"column"/.test(m)),
      ).toBe(true);
      expect(messages.some((m) => /'string' is not assignable to type 'number'/.test(m))).toBe(true);
      expect(messages.some((m) => /is not assignable to type 'Action'/.test(m))).toBe(true);
      expect(messages.some((m) => /fontSze/.test(m))).toBe(true);
    },
    TYPECHECK_TIMEOUT,
  );

  test(
    "a flat style attribute (sibling of style) is rejected",
    () => {
      const flat = `
import { View } from "@voidhash/paywalls/compose";
View({ gap: 8 });
`;
      const messages = typeCheck(dts, flat);
      expect(messages.some((m) => /gap/.test(m))).toBe(true);
    },
    TYPECHECK_TIMEOUT,
  );
});

// ---- helpers -------------------------------------------------------------

/** All `.ts`/`.tsx` files under `src/compose` (test uses the real graph). */
function composeSourceFiles(): string[] {
  return readdirSync(COMPOSE_DIR)
    .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
    .map((name) => path.join(COMPOSE_DIR, name));
}

/** Export names declared by a module, via the TS scanner (comment/string-safe). */
function surfaceExportNames(source: string): string[] {
  const sf = ts.createSourceFile("surface.ts", source, ts.ScriptTarget.Latest, true);
  const names: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node)) &&
      node.name &&
      hasExport(node)
    ) {
      names.push(node.name.text);
    }
    if (ts.isVariableStatement(node) && hasExport(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          names.push(decl.name.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return names;
}

function hasExport(node: ts.Node): boolean {
  return (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0;
}

/**
 * The top-level symbol names DECLARED in the generated ambient d.ts string
 * (`(export)? (declare)? const|function|interface|type <name>`). A regex
 * extraction is sufficient here — the generated source is a self-contained,
 * machine-emitted ambient module with no comments or nested declarations to
 * confuse it. Used by the reverse (dts → surface) sync direction.
 */
function declaredNames(dts: string): string[] {
  const decl = /(?:export\s+)?(?:declare\s+)?(?:const|function|interface|type)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  const names = new Set<string>();
  for (const match of dts.matchAll(decl)) {
    if (match[1]) {
      names.add(match[1]);
    }
  }
  return [...names];
}

/** The import module specifiers of a source file, via the TS parser. */
function importSpecifiers(source: string, fileName: string): string[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const specifiers: string[] = [];
  for (const statement of sf.statements) {
    if (
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      specifiers.push(statement.moduleSpecifier.text);
    }
  }
  return specifiers;
}

/**
 * Compile an author file against the generated ambient d.ts and return the
 * semantic diagnostic messages. The author file uses the tags as plain calls,
 * so no JSX runtime / factory is involved.
 */
function typeCheck(dts: string, author: string): string[] {
  const files: Record<string, string> = { "/lib.d.ts": dts, "/author.ts": author };
  const opts: ts.CompilerOptions = {
    noEmit: true,
    strict: true,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(opts);
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (name, lang, onError) =>
    files[name] ? ts.createSourceFile(name, files[name], lang, true) : original(name, lang, onError);
  host.fileExists = (f) => f in files || ts.sys.fileExists(f);
  host.readFile = (f) => files[f] ?? ts.sys.readFile(f);
  const program = ts.createProgram(["/lib.d.ts", "/author.ts"], opts, host);
  const sf = program.getSourceFile("/author.ts")!;
  return program
    .getSemanticDiagnostics(sf)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, " "));
}
