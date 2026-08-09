/**
 * ADVERSARIAL PROBE — BuildWire JSON/structuredClone safety across the container boundary.
 *
 * The container `build` pass returns the verbatim `@voidhash/paywall-build`
 * `BuildResult` inside `BuildWire.result`, which must round-trip a Cloudflare
 * Container/Durable-Object RPC boundary. That boundary serializes via the
 * structured-clone algorithm (and the manifest cache further JSON-encodes), which
 * THROWS on a function and drops nothing silently only for plain data. A manifest
 * is USER-CODE-DERIVED (evaluated `defineComponent`), so a function / Map / Set /
 * circular ref smuggled into the artifacts would be an uncatchable
 * `DataCloneError` at the DO boundary — a crash, not a diagnostic.
 *
 * This probe builds a rich real component (props with defaults, actions, a slot)
 * with the node caps (the SAME `buildPaywall` + `parseComponentManifest` the
 * container runs) and asserts the whole `BuildResult` survives BOTH
 * `structuredClone` (the DO/Container mechanism) AND a `JSON.stringify`/`parse`
 * round-trip with zero data loss — i.e. the manifest validator hands back a
 * plain, JSON-safe value.
 */
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { buildFromFiles } from "./test-helpers.ts";
import { makeNodeCapabilities } from "./node-capabilities.ts";

/** The JSON text codec the probe round-trips a `BuildResult` through. */
const JsonText = Schema.fromJsonString(Schema.Unknown);
const encodeJson = Schema.encodeSync(JsonText);
const decodeJson = Schema.decodeSync(JsonText);

const HEADING = `import { defineComponent, View, Text, Pressable, Slot } from "@voidhash/paywalls";

export default defineComponent({
  title: "Rich",
  props: (p) => ({
    label: p.string().default("Yearly"),
    count: p.number().default(3),
    on: p.boolean().default(true),
  }),
  actions: (a) => ({ onSelect: a.action() }),
  render: ({ props, actions }) => (
    <Pressable onPress={actions.onSelect}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 18 }}>{props.label}</Text>
        <Slot />
      </View>
    </Pressable>
  ),
});
`;

const COMPOSITION = `import { definePaywall, Screen, View } from "@voidhash/paywalls";
import Rich from "./components/rich";

export default definePaywall({
  render: () => (
    <Screen>
      <View style={{ gap: 12 }}>
        <Rich label="Pro" count={5} />
      </View>
    </Screen>
  ),
});
`;

/** Whether a value is a non-null object (arrays included) worth descending into. */
function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Recursively assert a value is structured-clone / JSON safe: no functions, no
 * `undefined` leaves inside arrays, no non-plain objects (Map/Set/Date leak as
 * their own tags but a manifest should carry none), and no circular refs. Returns
 * the list of offending key-paths (empty = safe).
 */
function jsonUnsafePaths(value: unknown, path = "$", seen = new Set<unknown>()): string[] {
  const offenders: string[] = [];
  const t = typeof value;
  if (t === "function" || t === "symbol" || t === "bigint") {
    offenders.push(`${path}: ${t}`);
    return offenders;
  }
  if (!isObjectLike(value)) {
    return offenders;
  }
  if (seen.has(value)) {
    offenders.push(`${path}: circular`);
    return offenders;
  }
  seen.add(value);
  if (value instanceof Map) {
    offenders.push(`${path}: Map`);
    return offenders;
  }
  if (value instanceof Set) {
    offenders.push(`${path}: Set`);
    return offenders;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => offenders.push(...jsonUnsafePaths(item, `${path}[${i}]`, seen)));
    return offenders;
  }
  for (const [k, v] of Object.entries(value)) {
    offenders.push(...jsonUnsafePaths(v, `${path}.${k}`, seen));
  }
  return offenders;
}

describe("PROBE — BuildWire (BuildResult) is structuredClone + JSON safe", () => {
  it(
    "a rich component's whole BuildResult round-trips structuredClone AND JSON with no loss",
    () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const result = yield* Effect.promise(() =>
            buildFromFiles(
              { "/paywall.tsx": COMPOSITION, "/components/rich.tsx": HEADING },
              makeNodeCapabilities(),
            ),
          );

          // The build must succeed with a ready component + manifest (otherwise the
          // probe is vacuous — there's no manifest to test for safety).
          expect(result.ok, encodeJson(result.diagnostics)).toBe(true);
          if (!result.ok || result.artifacts === undefined) return;
          const rich = result.artifacts.components.find((c) => c.path === "components/rich.tsx");
          expect(rich?.status).toBe("ready");
          expect(rich?.manifest, "expected a non-null extracted manifest").not.toBeNull();

          // 1. No JSON-unsafe leaf anywhere in the BuildResult (functions, Map/Set,
          //    symbol, bigint, circular).
          const offenders = jsonUnsafePaths(result);
          expect(offenders, `JSON-unsafe values in BuildResult: ${offenders.join(", ")}`).toEqual(
            [],
          );

          // 2. structuredClone is the exact mechanism the Container/DO RPC uses; it
          //    THROWS (DataCloneError) on a function/symbol. It must not throw.
          expect(() => structuredClone(result)).not.toThrow();

          // 3. A JSON round-trip must be lossless (the manifest cache JSON-encodes it).
          const cloned = decodeJson(encodeJson(result));
          expect(cloned).toEqual(result);
        }),
      ),
    30_000,
  );

  it("a manifest cannot smuggle a function even if user source attaches one to the definition", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        // A component that assigns a stray function-valued property onto the exported
        // definition object. The extractor reads the DECLARED props/actions/slots, so
        // the stray function must NOT reach the manifest.
        const sneaky = `import { defineComponent, Text } from "@voidhash/paywalls";

const def = defineComponent({
  title: "Sneaky",
  props: (p) => ({ text: p.string().default("x") }),
  render: ({ props }) => <Text>{props.text}</Text>,
});
// Attach a rogue function property directly on the exported object.
(def as unknown as Record<string, unknown>).evil = () => "boom";
export default def;
`;
        const result = yield* Effect.promise(() =>
          buildFromFiles(
            {
              "/paywall.tsx": `import { definePaywall, Screen } from "@voidhash/paywalls";
import Sneaky from "./components/sneaky";
export default definePaywall({ render: () => <Screen><Sneaky text="a" /></Screen> });
`,
              "/components/sneaky.tsx": sneaky,
            },
            makeNodeCapabilities({ typecheck: false }),
          ),
        );

        // Whether the build is ok or not, NOTHING in the result may carry the function.
        const offenders = jsonUnsafePaths(result);
        expect(offenders, `function leaked into BuildResult: ${offenders.join(", ")}`).toEqual([]);
        expect(() => structuredClone(result)).not.toThrow();
      }),
    ));
});
