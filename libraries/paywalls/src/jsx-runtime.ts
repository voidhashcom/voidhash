/**
 * `@voidhash/paywalls/jsx-runtime` — re-exports React's automatic JSX runtime
 * so `jsxImportSource: "@voidhash/paywalls"` resolves everywhere (studio
 * sandbox, CLI, user projects). Paywall primitives are plain React components,
 * so the runtime is React's own — this entry only spares author toolchains a
 * separate `react` mapping.
 */
export { Fragment, jsx, jsxs } from "react/jsx-runtime";
