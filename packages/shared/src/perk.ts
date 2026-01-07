import { Schema } from "effect";

export class PerkServiceError extends Schema.TaggedError<PerkServiceError>()(
  "PerkServiceError",
  {
    cause: Schema.String,
  }
) {}

export class PerkNotFoundError extends Schema.TaggedError<PerkNotFoundError>()(
  "PerkNotFoundError",
  {
    message: Schema.String,
  }
) {}

export class PerkSlugAlreadyExistsError extends Schema.TaggedError<PerkSlugAlreadyExistsError>()(
  "PerkSlugAlreadyExistsError",
  {
    slug: Schema.String,
  }
) {
  toString(): string {
    return `The following perk slug already exists: ${this.slug}`;
  }
}
