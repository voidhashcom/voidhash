import { defineConfig } from "vite";
import { recommended } from "oxlint-plugin-effect/presets/recommended";

/**
 * Rules from the Effect preset that encode an Effect-native *idiom* rather than a
 * correctness property. They are the right default for server and library code, but
 * counterproductive in React surfaces: `noTernary` outlaws `{cond ? <A/> : <B/>}`,
 * `noGlobals` outlaws `console`/`fetch`/`Date` in the browser, and `noAsyncFunction`
 * outlaws ordinary event handlers.
 *
 * The rules NOT listed here — noThrowStatement, noTryCatch, noNewPromise,
 * noNodeBuiltinImport, noDynamicImports, noEffectDo, noEffectBind — stay at `error`
 * everywhere, because they flag genuine problems regardless of the surface.
 */
const reactErgonomicRules = {
  "effect/noAs": "off",
  "effect/noAsyncFunction": "off",
  "effect/noGlobals": "off",
  "effect/noNewError": "off",
  "effect/noTernary": "off",
};

/**
 * Packages that carry NO `effect` dependency: plain-TypeScript libraries whose public
 * API is synchronous and signals failure by throwing. `mimic-core` is the zero-dependency
 * CRDT engine underneath `mimic`, `mimic-schema`, `ai-shared` and the backend apps;
 * `paywalls` is the standalone paywall runtime; `paywall-style-engine` is the pure
 * style/layout engine shared by the designer, the AI edit path and the renderers, whose
 * whole point is to be a synchronous pure-function layer over `mimic-schema` + csstype.
 *
 * Every `effect/*` rule is off here, because the only way to satisfy them is to add
 * Effect as a dependency and make each library's API effectful — which would change what
 * these packages are and ripple through every consumer. Revisit this list if one of them
 * ever adopts Effect; the rules should come back on with it.
 */
const nonEffectPackages = [
  "libraries/paywalls/**",
  "vendored/mimic/packages/mimic-core/**",
  "vendored/mimic/packages/mimic/**",
  "packages/paywall-style-engine/**",
];

/**
 * The public example apps under `examples/` (the `mimic-example` and internal
 * `react-native-example` harnesses excepted). These exist to be read and copied by
 * external developers integrating an SDK, so they must look like ordinary Node and
 * React Native code: `try`/`catch` around an SDK call, `throw` on a bad config, and
 * `node:http` for a server. Holding them to the Effect idiom would teach the reader
 * a style the SDKs themselves do not require — the published `@voidhash/node` client
 * returns plain Promises.
 *
 * Paths are repo-relative here and carry a `voidhash/` prefix in the mono root config;
 * the two lists must describe the same set of directories.
 */
const publicExamples = [
  "examples/app-android/**",
  "examples/app-ios/**",
  "examples/app-react-native/**",
  "examples/backend-go/**",
  "examples/backend-node/**",
  "examples/backend-php/**",
  "examples/backend-rust/**",
];

const effectRulesOff = Object.fromEntries(Object.keys(recommended).map((rule) => [rule, "off"]));

/**
 * React application and UI-component surfaces, where the ergonomic rules are relaxed.
 *
 * Paths are repo-relative here and carry a `voidhash/` prefix in the mono root config;
 * the two lists must describe the same set of directories.
 */
const reactSurfaces = [
  "vendored/mimic/apps/mimic-admin/**",
  "apps/www/**",
  "examples/**",
  "libraries/react-native/**",
  "packages/web-app/**",
  "packages/paywall-renderer-preact/**",
  "packages/paywall-renderer-web-core/**",
  "packages/ui/**",
];

/**
 * Repository-root config for standalone OSS clones. Vite itself is only used
 * per-app (each app carries its own `vite.config.ts`); this file exists so
 * `vp lint` / `vp check` pick up the shared lint policy. vite-plus reads lint
 * config from `vite.config.ts` under the `lint` key — a root `.oxlintrc.json`
 * is NOT auto-discovered and is silently ignored.
 *
 * Kept in sync with the mono root config so `pnpm lint` reports identically
 * whether it runs from this repo or from a mono checkout.
 */
export default defineConfig({
  lint: {
    // Emitted by `pnpm openapi:generate`; fixes there would be overwritten on the
    // next regeneration.
    ignorePatterns: ["packages/generated-clients/src/**/generated.ts"],
    jsPlugins: ["oxlint-plugin-effect/plugin"],
    rules: recommended,
    // `typeAware` enables the tsgolint-backed rules (no-floating-promises,
    // await-thenable, no-base-to-string, …) that need type information.
    //
    // `typeCheck` is deliberately OFF. It re-runs tsc from this root config, which
    // resolves files no package tsconfig includes (`**/scripts/**`, `vite.config.ts`)
    // without their package's `jsx` / `allowImportingTsExtensions` settings, producing
    // phantom TS17004/TS5097 errors. `turbo typecheck` already typechecks every
    // package against its own tsconfig, and is green.
    options: {
      typeAware: true,
      typeCheck: false,
    },
    overrides: [
      { files: reactSurfaces, rules: reactErgonomicRules },
      { files: nonEffectPackages, rules: effectRulesOff },
      { files: publicExamples, rules: effectRulesOff },
    ],
  },
});
