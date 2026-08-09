import { sandboxDts } from "@voidhash/paywalls/sandbox-dts";
import ts from "typescript";
import type { BuildDiagnostic } from "./diagnostics.ts";
import { error } from "./diagnostics.ts";
import type { ResolvedComponent } from "./imports.ts";
import { DEFAULT_LIB, LIB_ASSETS } from "./lib/index.ts";
import { withTrailingSlash } from "./paths.ts";
import type { TypecheckOptions } from "./types.ts";

/** The virtual path the SDK ambient dts is mounted at inside the program. */
const SDK_DTS_PATH = "/__sdk__/paywalls.d.ts";
/** The virtual directory the lib assets are mounted under. */
const LIB_DIR = "/__lib__";

/**
 * Compiler options mirroring the studio's Monaco setup (code-editor-pane.tsx):
 * react-jsx with the paywall jsxImportSource, Node module resolution, strict,
 * noEmit, ES2020 target, and `.tsx`-extension imports allowed. `allowJs` off,
 * `skipLibCheck` on (the ambient SDK dts is authoritative).
 */
const COMPILER_OPTIONS: ts.CompilerOptions = {
  allowImportingTsExtensions: true,
  allowNonTsExtensions: true,
  esModuleInterop: true,
  jsx: ts.JsxEmit.ReactJSX,
  jsxImportSource: "@voidhash/paywalls",
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  noEmit: true,
  skipLibCheck: true,
  strict: true,
  target: ts.ScriptTarget.ES2020,
  // The lib files live in a virtual dir; point the compiler there so it never
  // probes the real typescript install for `lib.*.d.ts`.
  lib: [`${LIB_DIR}/${DEFAULT_LIB}`],
};

/** The virtual lib path a caller-supplied lib name mounts at. */
function libPathFor(name: string): string {
  // Accept both bare lib names and pre-mounted virtual paths.
  if (name.startsWith("/")) return name;
  return `${LIB_DIR}/${name}`;
}

/** The script kind a virtual file is parsed as. */
function scriptKindOf(fileName: string): ts.ScriptKind {
  if (fileName.endsWith(".tsx")) return ts.ScriptKind.TSX;
  return ts.ScriptKind.TS;
}

/**
 * Stage 2 — e2e typecheck.
 *
 * Builds a `ts.Program` over a CompilerHost backed ENTIRELY by the fork files
 * plus in-memory assets (the SDK ambient dts + the generated lib set). The host
 * NEVER delegates to `ts.sys` or the real filesystem — `fileExists`/`readFile`/
 * `getSourceFile` and the directory methods all resolve purely over the virtual
 * path space, because an FS-backed directory method silently breaks relative
 * module resolution over virtual files (spike-proven caveat).
 *
 * Reports every semantic + syntactic diagnostic attributed to a fork file, with
 * a 1-based position converted from the TS offset.
 *
 * @param entryPath absolute entry path (used as the diagnostic path for the entry)
 * @param entrySource the entry `.tsx` source
 * @param components the resolved component set (all built together, cross-file)
 * @param options extra lib assets, when supplied by the capability
 */
export function typecheck(
  entryPath: string,
  entrySource: string,
  components: readonly ResolvedComponent[],
  options: TypecheckOptions,
): readonly BuildDiagnostic[] {
  // The virtual file map the whole program is resolved against.
  const files = new Map<string, string>();
  files.set(entryPath, entrySource);
  for (const component of components) {
    files.set(component.absPath, component.source);
  }
  files.set(SDK_DTS_PATH, sandboxDts);

  // Lib assets: built-in set, then the ambient SDK dts, then caller overrides.
  const libFiles = new Map<string, string>();
  for (const [name, contents] of Object.entries(LIB_ASSETS)) {
    libFiles.set(`${LIB_DIR}/${name}`, contents);
  }
  for (const [name, contents] of Object.entries(options.libs ?? {})) {
    libFiles.set(libPathFor(name), contents);
  }

  const readVirtual = (path: string): string | undefined =>
    files.get(path) ?? libFiles.get(path);

  const sourceFileCache = new Map<string, ts.SourceFile>();
  const host: ts.CompilerHost = {
    fileExists: (path) => readVirtual(path) !== undefined,
    readFile: (path) => readVirtual(path),
    getSourceFile: (fileName, languageVersion) => {
      const cached = sourceFileCache.get(fileName);
      if (cached) return cached;
      const contents = readVirtual(fileName);
      if (contents === undefined) return undefined;
      const sourceFile = ts.createSourceFile(
        fileName,
        contents,
        languageVersion,
        /* setParentNodes */ true,
        scriptKindOf(fileName),
      );
      sourceFileCache.set(fileName, sourceFile);
      return sourceFile;
    },
    // The lib the program requests resolves through our virtual lib dir.
    getDefaultLibFileName: () => `${LIB_DIR}/${DEFAULT_LIB}`,
    getDefaultLibLocation: () => LIB_DIR,
    writeFile: () => {
      // noEmit — never called; a no-op keeps the host total.
    },
    getCurrentDirectory: () => "/",
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    // Directory methods resolved over the virtual path space ONLY. Delegating
    // any of these to the real FS silently breaks relative resolution.
    directoryExists: (dir) => {
      const prefix = withTrailingSlash(dir);
      for (const path of files.keys()) if (path.startsWith(prefix)) return true;
      for (const path of libFiles.keys()) if (path.startsWith(prefix)) return true;
      return dir === "/" || dir === LIB_DIR;
    },
    getDirectories: () => [],
    readDirectory: () => [],
    realpath: (path) => path,
  };

  const forkNames = [entryPath, ...components.map((c) => c.absPath)];
  // The ambient SDK dts is a root file too, so its `declare module
  // "@voidhash/paywalls"` (+ /panel, /jsx-runtime) globally satisfies every
  // fork import — but it is NOT a fork file, so its own diagnostics are dropped.
  const rootNames = [...forkNames, SDK_DTS_PATH];
  const program = ts.createProgram(rootNames, COMPILER_OPTIONS, host);

  const rawDiagnostics = [
    ...program.getSyntacticDiagnostics(),
    ...program.getSemanticDiagnostics(),
    ...program.getGlobalDiagnostics(),
  ];

  const forkPaths = new Set<string>(forkNames);
  const out: BuildDiagnostic[] = [];
  for (const diagnostic of rawDiagnostics) {
    const file = diagnostic.file;
    // Only surface diagnostics attributed to a fork file (never lib/SDK-internal).
    if (!file || !forkPaths.has(file.fileName)) continue;
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    let position: { line: number; column: number } | undefined;
    if (typeof diagnostic.start === "number") {
      const { line, character } = file.getLineAndCharacterOfPosition(diagnostic.start);
      position = { line: line + 1, column: character + 1 };
    }
    out.push(error(file.fileName, "types", message, position));
  }
  return out;
}
