/**
 * `@voidhash/paywalls/jsx-dev-runtime` — the development counterpart of
 * `./jsx-runtime`, re-exporting React's dev JSX runtime so tooling that emits
 * `jsxDEV` calls (dev builds under `jsxImportSource: "@voidhash/paywalls"`)
 * resolves correctly.
 */
export { Fragment, jsxDEV } from "react/jsx-dev-runtime";
