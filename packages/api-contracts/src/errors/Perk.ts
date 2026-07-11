import { Schema } from "effect";

/** Generic perk service error */
export class ApiPerkServiceError extends Schema.TaggedErrorClass<ApiPerkServiceError>()(
  "Api/PerkServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/** Perk not found */
export class ApiPerkNotFoundError extends Schema.TaggedErrorClass<ApiPerkNotFoundError>()(
  "Api/PerkNotFoundError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

/** Perk slug already exists */
export class ApiPerkSlugAlreadyExistsError extends Schema.TaggedErrorClass<ApiPerkSlugAlreadyExistsError>()(
  "Api/PerkSlugAlreadyExistsError",
  {
    slug: Schema.String,
  },
  { httpApiStatus: 409 },
) {
  override toString(): string {
    return `The following perk slug already exists: ${this.slug}`;
  }
}
