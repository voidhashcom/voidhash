import * as Schema from "effect/Schema";

import { PageParams } from "../Pagination.ts";
import { ProductType } from "../Schema.ts";

/**
 * Query parameters of `GET /products`. `type` filters the page down to a single
 * product kind; `projectId` names the tenant and is required for credentials
 * that span more than one project.
 */
export const ProductListParams = Schema.Struct({
  ...PageParams.fields,
  projectId: Schema.optional(Schema.String),
  type: Schema.optional(ProductType),
}).annotate({ identifier: "ProductListParams" });
export type ProductListParams = typeof ProductListParams.Type;

/**
 * Query parameters of `GET /perks`. Perks carry no filterable attribute beyond
 * their project, so this is `PageParams` plus the tenant address.
 */
export const PerkListParams = Schema.Struct({
  ...PageParams.fields,
  projectId: Schema.optional(Schema.String),
}).annotate({ identifier: "PerkListParams" });
export type PerkListParams = typeof PerkListParams.Type;

/**
 * Body of `POST /products`. `duration` is only meaningful for `subscription`
 * products, where it is required; it is ignored (and stored as `null`) for the
 * one-time kinds. `projectId` is optional for a secret key, which is scoped to
 * exactly one project, and required otherwise.
 */
export class CreateProductBody extends Schema.Class<CreateProductBody>("CreateProductBody")({
  duration: Schema.optional(Schema.Number),
  name: Schema.String,
  projectId: Schema.optional(Schema.String),
  slug: Schema.String,
  type: ProductType,
}) {}

/**
 * Body of `PATCH /products/:productId`. Only the mutable descriptive fields are
 * patchable: a product's type and duration are load-bearing for billing, so
 * changing them means creating a new product.
 */
export class UpdateProductBody extends Schema.Class<UpdateProductBody>("UpdateProductBody")({
  name: Schema.optional(Schema.String),
  slug: Schema.optional(Schema.String),
}) {}

/**
 * Body of `POST /perks`. `projectId` follows the same rule as every other
 * project-scoped write: optional for a secret key, required otherwise.
 */
export class CreatePerkBody extends Schema.Class<CreatePerkBody>("CreatePerkBody")({
  name: Schema.String,
  projectId: Schema.optional(Schema.String),
  slug: Schema.String,
}) {}

/** Body of `PATCH /perks/:perkId`. */
export class UpdatePerkBody extends Schema.Class<UpdatePerkBody>("UpdatePerkBody")({
  name: Schema.optional(Schema.String),
  slug: Schema.optional(Schema.String),
}) {}

/**
 * Body of `POST /products/:productId/perks`. The product comes from the path,
 * so only the perk being attached is supplied.
 */
export class AttachProductPerkBody extends Schema.Class<AttachProductPerkBody>(
  "AttachProductPerkBody",
)({
  perkId: Schema.String,
}) {}
