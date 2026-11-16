import { constant } from "@voidhash/lib/lang";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";

import {
  VOIDHASH_FETCHED_AT_COMMENT_PREFIX,
  VOIDHASH_VERSION_COMMENT_PREFIX,
  parseVersionFromDeclaration,
} from "../../utils/schema/version";
import type { Writable } from "../../utils/types";
import type { NormalizedProduct, NormalizedSchema } from "../schema/normalized-schema";
import type { PackageJson } from "../schema/package-json";
import type { VoidhashConfig } from "../schema/voidhash-config";
import type { GeneratedFeatureFlag } from "./schema";
import * as Arr from "effect/Array";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";

/** Encodes a slug as a quoted TypeScript string literal. */
const toStringLiteral = Schema.encodeSync(Schema.fromJsonString(Schema.String));

function toUnionType(slugs: string[]): string {
  if (Arr.isReadonlyArrayEmpty(slugs)) {
    return "never";
  }
  return slugs.map((slug) => toStringLiteral(slug)).join(" | ");
}

/**
 * The SDK product type a Studio product type stands for, which
 * `@voidhash/react-native` narrows a product by: a `subscription` slug is a
 * `SubscriptionProduct`, a `one-time-consumable` one a `ConsumableProduct`,
 * and a `one-time` one a `NonConsumableProduct` or, sold on the App Store as
 * a non-renewing subscription, a `NonRenewingSubscriptionProduct`. The SDK
 * leaves out a product the store sells as another type, so a slug's product
 * is one of these or missing.
 */
const SDK_PRODUCT_TYPES = {
  "one-time": "nonConsumable",
  "one-time-consumable": "consumable",
  subscription: "subscription",
} as const satisfies Record<NormalizedProduct["type"], string>;

/** The SDK packages whose `VoidhashRegister` the declaration file augments. */
export type TypedSdkPackage = "@voidhash/react-native" | "@voidhash/web";

/**
 * The SDK packages an app depends on, in the order the declaration file
 * augments them. Augmenting a module the app does not install fails to
 * compile, so only these are; an app depending on neither (or without a
 * `package.json`) gets `@voidhash/react-native`, as before the web SDK had a
 * registry.
 */
export const typedSdkPackagesOf = (
  packageJson: Option.Option<PackageJson>,
): ReadonlyArray<TypedSdkPackage> => {
  const installed: ReadonlyArray<string> = Option.match(packageJson, {
    onNone: () => [],
    onSome: (manifest) => [
      ...R.keys(manifest.dependencies ?? {}),
      ...R.keys(manifest.devDependencies ?? {}),
      ...R.keys(manifest.peerDependencies ?? {}),
    ],
  });
  const packages = Arr.filter(["@voidhash/react-native", "@voidhash/web"] as const, (name) =>
    installed.includes(name),
  );
  return Arr.isReadonlyArrayEmpty(packages) ? ["@voidhash/react-native"] : packages;
};

/**
 * Generate the contents of the `voidhash.gen.d.ts` declaration file.
 *
 * The version baked into the header is supplied by the caller (and ultimately
 * by the server's `GET /api/v1/projects/{projectId}/schema` and
 * `.../schema/version` endpoints) so client and server can never disagree on
 * the hash. Feature flags are not part of that version.
 *
 * The file:
 * - Starts with a `@voidhash:version` header so `voidhash-cli types check` and the
 *   dev-mode runtime warning can detect staleness without re-downloading the
 *   full schema.
 * - Augments each of `packages`' `VoidhashRegister` interface. For
 *   `@voidhash/react-native`, all typed hook arguments (slug literals)
 *   resolve via the registry, and `productTypes` types each product by its
 *   slug. For both SDKs, `schema.flags` lists the flag keys and `flagValues`
 *   the text values of each flag's variants. A file generated before
 *   `productTypes`, `flags` or `flagValues` existed still compiles: those are
 *   then untyped.
 */
export function generateTypesDeclaration(
  schema: NormalizedSchema,
  version: string,
  options: {
    fetchedAt: Date;
    flags: ReadonlyArray<GeneratedFeatureFlag>;
    packages: ReadonlyArray<TypedSdkPackage>;
  },
): string {
  const fetchedAt = options.fetchedAt.toISOString();

  const productSlugs = Arr.sort(MutableHashMap.keys(schema.products), Order.String);
  const locationSlugs = Arr.sort(MutableHashMap.keys(schema.locations), Order.String);
  const perkSlugs = Arr.sort(MutableHashMap.keys(schema.perks), Order.String);
  const flags = Arr.sort(
    options.flags,
    Order.mapInput(Order.String, (flag: GeneratedFeatureFlag) => flag.key),
  );

  const flagLines = {
    key: `      flags: ${toUnionType(flags.map((flag) => flag.key))};`,
    values: [
      "    flagValues: {",
      ...flags
        .filter((flag) => Arr.isReadonlyArrayNonEmpty(flag.values))
        .map(
          (flag) =>
            `      ${toStringLiteral(flag.key)}: ${toUnionType(Arr.sort(flag.values, Order.String))};`,
        ),
      "    };",
    ],
  };

  const reactNativeBlock = [
    'declare module "@voidhash/react-native" {',
    "  interface VoidhashRegister {",
    "    schema: {",
    `      products: ${toUnionType(productSlugs)};`,
    `      locations: ${toUnionType(locationSlugs)};`,
    `      perks: ${toUnionType(perkSlugs)};`,
    flagLines.key,
    "    };",
    "    productTypes: {",
    ...Arr.getSomes(
      productSlugs.map((slug) =>
        Option.map(
          MutableHashMap.get(schema.products, slug),
          (product) =>
            `      ${toStringLiteral(slug)}: ${toStringLiteral(SDK_PRODUCT_TYPES[product.type])};`,
        ),
      ),
    ),
    "    };",
    ...flagLines.values,
    "  }",
    "}",
  ];

  const webBlock = [
    'declare module "@voidhash/web" {',
    "  interface VoidhashRegister {",
    "    schema: {",
    flagLines.key,
    "    };",
    ...flagLines.values,
    "  }",
    "}",
  ];

  return [
    "// voidhash.gen.d.ts — generated by voidhash-cli, do not edit",
    `${VOIDHASH_VERSION_COMMENT_PREFIX}${version}`,
    `${VOIDHASH_FETCHED_AT_COMMENT_PREFIX}${fetchedAt}`,
    ...options.packages.flatMap((sdkPackage) => [
      "",
      ...(sdkPackage === "@voidhash/web" ? webBlock : reactNativeBlock),
    ]),
    "",
    "export {};",
    "",
  ].join("\n");
}

const make = Effect.fn("make")(function* effect() {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  /**
   * Scaffold the SDK client module (`voidhash.ts` / `.js`) that wires up
   * `@voidhash/react-native` with the project's publishable key.
   *
   * The key is pre-filled as the default so the file works out of the box;
   * the user is free to edit it and the client options afterwards. The client
   * is exported as a single `voidhash` object, so the rest of the app uses it
   * like `<voidhash.Provider>` or `voidhash.useProducts()`. The parent
   * directory (`src/lib` or `lib`) is created if it does not exist yet.
   */
  const generateClientFile = (filePath: string, options: { publishableKey: string }) =>
    Effect.fn("generateClientFile")(function* generateClientFile() {
      yield* fileSystem.makeDirectory(path.dirname(filePath), {
        recursive: true,
      });
      const lines = [
        'import { createVoidhashClient } from "@voidhash/react-native";',
        "",
        "/**",
        " * Voidhash SDK client. Safe to edit.",
        " *",
        " * Use it like `<voidhash.Provider>` and `voidhash.useProducts()`. The",
        " * publishable key is safe to ship in client code.",
        " */",
        `export const voidhash = createVoidhashClient("${options.publishableKey}", { dev: true });`,
        "",
      ];
      yield* fileSystem.writeFileString(filePath, lines.join("\n"));
    })();

  const generateVoidhashConfigFile = (
    filePath: string,
    config: Writable<typeof VoidhashConfig.Type>,
  ) =>
    Effect.fn("generateVoidhashConfigFile")(function* generateVoidhashConfigFile() {
      const lines = [
        "import { defineConfig } from 'voidhash-cli';",
        "",
        "export default defineConfig({",
        `  team: '${config.team}',`,
        `  project: '${config.project}',`,
      ];
      if (config.typesOutput !== undefined) {
        lines.push(`  typesOutput: '${config.typesOutput}',`);
      }
      lines.push("});", "");
      yield* fileSystem.writeFileString(filePath, lines.join("\n"));
    })();

  /**
   * Generate the `.d.ts` declaration file from the remote schema and flags and
   * write it to disk. `version` is the server-provided hash that gets baked
   * into the header so the CI gate / dev-mode warning can detect drift.
   */
  const generateTypesDeclarationFile = (
    filePath: string,
    schema: NormalizedSchema,
    version: string,
    options: {
      flags: ReadonlyArray<GeneratedFeatureFlag>;
      packages: ReadonlyArray<TypedSdkPackage>;
    },
  ) =>
    Effect.fn("generateTypesDeclarationFile")(function* generateTypesDeclarationFile() {
      const fetchedAt = yield* DateTime.nowAsDate;
      const content = generateTypesDeclaration(schema, version, { fetchedAt, ...options });
      yield* fileSystem.writeFileString(filePath, content);
      return version;
    })();

  const readDeclarationVersion = (filePath: string) =>
    Effect.fn("readDeclarationVersion")(function* readDeclarationVersion() {
      const content = yield* fileSystem.readFileString(filePath);
      return parseVersionFromDeclaration(content);
    })();

  return constant({
    generateClientFile,
    generateTypesDeclarationFile,
    generateVoidhashConfigFile,
    readDeclarationVersion,
  });
})();

type CodegenShape = Effect.Success<typeof make>;

export class Codegen extends Context.Service<Codegen, CodegenShape>()("voidhash-cli/Codegen") {
  static Default = Layer.effect(Codegen, make);
}
