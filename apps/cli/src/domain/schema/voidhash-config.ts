import * as Schema from "effect/Schema";

/**
 * Default output path for the generated `.d.ts` when `typesOutput` is omitted
 * from `voidhash.config.ts`.
 */
export const DEFAULT_TYPES_OUTPUT = "voidhash.gen.d.ts";

export const VoidhashConfig = Schema.Struct({
  project: Schema.String,
  team: Schema.String,
  /**
   * Output path for the generated `.d.ts` declaration file. Optional —
   * defaults to `voidhash.gen.d.ts` at the project root.
   */
  typesOutput: Schema.optional(Schema.String),
});
export type VoidhashConfig = typeof VoidhashConfig.Type;

/**
 * Resolve `typesOutput` from a loaded config, applying the default.
 */
export function resolveTypesOutput(config: typeof VoidhashConfig.Type): string {
  return config.typesOutput ?? DEFAULT_TYPES_OUTPUT;
}
