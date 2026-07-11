/**
 * Perk domain — typed errors that signal a perk invariant violation. Row
 * data lives in the `perks` Drizzle table.
 */
import { Schema } from "effect";

/** Perk row not found in the database. */
export class PerkNotFoundError extends Schema.TaggedErrorClass<PerkNotFoundError>(
  "PerkNotFoundError",
)("PerkNotFoundError", { message: Schema.String }) {}

/** Perk slug uniqueness invariant violated within a project. */
export class PerkSlugAlreadyExistsError extends Schema.TaggedErrorClass<PerkSlugAlreadyExistsError>(
  "PerkSlugAlreadyExistsError",
)("PerkSlugAlreadyExistsError", { slug: Schema.String }) {}
