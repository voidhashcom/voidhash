import * as Schema from "effect/Schema";

import { PageParams } from "../Pagination.ts";
import { PersonTraits } from "../Schema.ts";

/**
 * Query parameters of `GET /persons`. `distinctId` and `email` are filters, not
 * addresses: a distinct id is a secondary key on the person, so looking one up
 * narrows the collection rather than naming a sub-resource. Passing
 * `distinctId` yields a page of at most one person, and an unknown value yields
 * an empty page rather than a 404.
 */
export const PersonListParams = Schema.Struct({
  ...PageParams.fields,
  distinctId: Schema.optional(Schema.String),
  email: Schema.optional(Schema.String),
  projectId: Schema.optional(Schema.String),
}).annotate({ identifier: "PersonListParams" });
export type PersonListParams = typeof PersonListParams.Type;

/**
 * Body of `POST /persons`. Adds the explicit `projectId` every project-scoped
 * write now accepts — required for user/`x-api-key` credentials that span more
 * than one project, optional for a secret key which is scoped to exactly one.
 */
export class CreatePersonRequestBody extends Schema.Class<CreatePersonRequestBody>(
  "CreatePersonRequestBody",
)({
  distinctId: Schema.String,
  email: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  projectId: Schema.optional(Schema.String),
}) {}

/**
 * Body of `PATCH /persons/:personId`. The person is named by the path, so the
 * distinct id that `SetPersonAttributesBody` carries is resolved from the row
 * instead of being supplied by the caller.
 */
export class UpdatePersonBody extends Schema.Class<UpdatePersonBody>("UpdatePersonBody")({
  email: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  // `$set_once` semantics — earliest write wins; loses to any `$set`.
  setOnce: Schema.optional(PersonTraits),
  // `$set` semantics — newest write wins per key.
  traits: Schema.optional(PersonTraits),
}) {}
