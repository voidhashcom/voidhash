/**
 * `@voidhash/paywalls/sandbox` — the studio's in-browser render surface.
 *
 * The studio bundles this entry (with react + react-reconciler + the author
 * surface bundled IN) into a single IIFE global, evals it once inside a
 * sandboxed iframe, then runs a compiled component (CJS) through a `require`
 * shim that maps every module specifier the author could import onto a sub-
 * object of {@link modules}. It renders each preview state to a §3 node tree
 * via the real reconciler path — the same `renderToNodeTree` the CLI runs.
 *
 * The bundle IIFE (`dist/sandbox.global.js`) is produced by `build.ts`; the
 * node-importable bundle text is `./sandbox-bundle` (a generated string) and
 * the Monaco ambient types are `sandboxDts` (also generated, from the real
 * `.d.ts`).
 */
import * as React from "react";
import * as ReactJsxDevRuntime from "react/jsx-dev-runtime";
import * as ReactJsxRuntime from "react/jsx-runtime";

import * as authorSurface from "../index";
import * as panelSurface from "../panel/index";

export { extractComponentManifest } from "../authoring/manifest";
// The panel authoring + session surface, so a future dedicated panel-sandbox
// document can drive `createPanelSession` inside the same iframe global.
export { createPanelSession, Panel } from "../panel/index";
export {
  type ComponentDescription,
  definitionHasPanel,
  describeComponent,
} from "./component-message";
export {
  defaultHostData,
  type SandboxHostData,
  type SandboxProduct,
  type SandboxVariables,
} from "./host-data";
export { renderComponentToTree, type RenderComponentInputs } from "./render-component";

/**
 * The module registry the sandbox `require` shim resolves against. Author code
 * imports only these specifiers; the shim maps each to the matching sub-object
 * so the iframe never loads real ES modules. `@voidhash/paywalls` and `react`
 * alias to the same objects the author surface exposes (paywall primitives are
 * real React), so a single shared React powers hooks and reconciliation.
 */
export const modules: Readonly<Record<string, unknown>> = {
  "@voidhash/paywalls": authorSurface,
  "@voidhash/paywalls/panel": panelSurface,
  "@voidhash/paywalls/jsx-runtime": ReactJsxRuntime,
  "@voidhash/paywalls/jsx-dev-runtime": ReactJsxDevRuntime,
  react: React,
  "react/jsx-runtime": ReactJsxRuntime,
  "react/jsx-dev-runtime": ReactJsxDevRuntime,
};

/** The IIFE global name the sandbox bundle assigns its exports to. */
export const SANDBOX_GLOBAL_NAME = "__VOIDHASH_PAYWALLS_SANDBOX__";
