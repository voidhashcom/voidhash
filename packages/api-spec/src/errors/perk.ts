import { HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";

/** Generic perk service error */
export class PerkServiceError extends Schema.TaggedError<PerkServiceError>()(
  "PerkServiceError",
  {
    cause: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}

/** Perk not found */
export class PerkNotFoundError extends Schema.TaggedError<PerkNotFoundError>()(
  "PerkNotFoundError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 404 })
) {}

/** Perk slug already exists */
export class PerkSlugAlreadyExistsError extends Schema.TaggedError<PerkSlugAlreadyExistsError>()(
  "PerkSlugAlreadyExistsError",
  {
    slug: Schema.String,
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  toString(): string {
    return `The following perk slug already exists: ${this.slug}`;
  }
}
