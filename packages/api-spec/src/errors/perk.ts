import { Schema } from "effect";

/** Generic perk service error */
export class PerkServiceError extends Schema.TaggedErrorClass<PerkServiceError>()(
  "PerkServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 }
) {}

/** Perk not found */
export class PerkNotFoundError extends Schema.TaggedErrorClass<PerkNotFoundError>()(
  "PerkNotFoundError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 }
) {}

/** Perk slug already exists */
export class PerkSlugAlreadyExistsError extends Schema.TaggedErrorClass<PerkSlugAlreadyExistsError>()(
  "PerkSlugAlreadyExistsError",
  {
    slug: Schema.String,
  },
  { httpApiStatus: 409 }
) {
  toString(): string {
    return `The following perk slug already exists: ${this.slug}`;
  }
}
