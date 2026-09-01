import * as Schema from "effect/Schema";

/** Generic person service error */
export class ApiPersonServiceError extends Schema.TaggedErrorClass<ApiPersonServiceError>()(
  "Api/PersonServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/** Person not found */
export class ApiPersonNotFoundError extends Schema.TaggedErrorClass<ApiPersonNotFoundError>()(
  "Api/PersonNotFoundError",
  {
    id: Schema.NonEmptyString,
  },
  { httpApiStatus: 404 },
) {
  override toString(): string {
    return `The following person not found: ${this.id}`;
  }
}

/**
 * Generic perk-grant service error. Entitlement reads hang off a person but are
 * served by `PerkGrantService`, so a failure there is reported under its own
 * tag rather than being folded into {@link ApiPersonServiceError} — the person
 * read succeeded, the grant lookup did not.
 */
export class ApiPerkGrantServiceError extends Schema.TaggedErrorClass<ApiPerkGrantServiceError>()(
  "Api/PerkGrantServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}
