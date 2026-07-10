import { Schema } from "effect";

/**
 * Default output path for the generated `.d.ts` when `typesOutput` is omitted
 * from `voidhash.config.ts`.
 */
export const DEFAULT_TYPES_OUTPUT = "voidhash.gen.d.ts";

export const VoidhashConfigSchema = Schema.Struct({
  project: Schema.String,
  team: Schema.String,
  /**
   * Output path for the generated `.d.ts` declaration file. Optional —
   * defaults to `voidhash.gen.d.ts` at the project root.
   */
  typesOutput: Schema.optional(Schema.String),
});

/**
 * Resolve `typesOutput` from a loaded config, applying the default.
 */
export function resolveTypesOutput(config: typeof VoidhashConfigSchema.Type): string {
  return config.typesOutput ?? DEFAULT_TYPES_OUTPUT;
}
