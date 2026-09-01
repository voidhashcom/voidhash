import * as Schema from "effect/Schema";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import {
  ApiActionForbiddenError,
  ApiProductNotFoundError,
  ApiProductPerkAlreadyExistsError,
  ApiProductPerkNotFoundError,
  ApiProductPerkServiceError,
  ApiProductPerkValidationError,
  ApiProductServiceError,
  ApiProductSlugAlreadyExistsError,
  ApiProductValidationError,
} from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import { paginated, PageParams } from "../Pagination.ts";
import {
  AttachProductPerkBody,
  CreateProductBody,
  ProductListParams,
  UpdateProductBody,
} from "../schemas/catalog.ts";
import { Product, ProductPerk } from "../Schema.ts";

export const ProductsGroup = HttpApiGroup.make("products")
  /**
   * Lists the products of one project, optionally narrowed to a single product
   * type.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("listProducts", "/", {
      query: ProductListParams,
      success: paginated(Product),
      error: [ApiActionForbiddenError, ApiProductServiceError],
    }),
  )
  /**
   * Creates a product. `subscription` products require a `duration`; the
   * one-time kinds store `null` regardless of what is sent.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.post("createProduct", "/", {
      payload: CreateProductBody,
      success: Product.pipe(HttpApiSchema.status(201)),
      error: [
        ApiActionForbiddenError,
        ApiProductServiceError,
        ApiProductSlugAlreadyExistsError,
        ApiProductValidationError,
      ],
    }),
  )
  /**
   * Reads a single product. The project is derived from the row, so no
   * `projectId` is needed.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("getProduct", "/:productId", {
      params: { productId: Schema.String },
      success: Product,
      error: [ApiActionForbiddenError, ApiProductNotFoundError, ApiProductServiceError],
    }),
  )
  /**
   * Renames a product or changes its slug. Type and duration are immutable —
   * they are load-bearing for billing, so a different shape means a different
   * product.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.patch("updateProduct", "/:productId", {
      params: { productId: Schema.String },
      payload: UpdateProductBody,
      success: Product,
      error: [
        ApiActionForbiddenError,
        ApiProductNotFoundError,
        ApiProductServiceError,
        ApiProductSlugAlreadyExistsError,
      ],
    }),
  )
  /**
   * Deletes a product along with its perk links. Provider mappings must be
   * removed first.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.delete("deleteProduct", "/:productId", {
      params: { productId: Schema.String },
      error: [
        ApiActionForbiddenError,
        ApiProductNotFoundError,
        ApiProductServiceError,
        ApiProductValidationError,
      ],
    }),
  )
  /**
   * Lists the perks attached to a product. This is the only address for the
   * product↔perk links; the flat `product_perks` group it replaced is gone.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("listProductPerks", "/:productId/perks", {
      params: { productId: Schema.String },
      query: PageParams,
      success: paginated(ProductPerk),
      error: [
        ApiActionForbiddenError,
        ApiProductNotFoundError,
        ApiProductPerkServiceError,
        ApiProductPerkValidationError,
        ApiProductServiceError,
      ],
    }),
  )
  /**
   * Attaches a perk to a product. Both must belong to the same project, and a
   * perk may only be attached once.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.post("attachProductPerk", "/:productId/perks", {
      params: { productId: Schema.String },
      payload: AttachProductPerkBody,
      success: ProductPerk.pipe(HttpApiSchema.status(201)),
      error: [
        ApiActionForbiddenError,
        ApiProductNotFoundError,
        ApiProductPerkAlreadyExistsError,
        ApiProductPerkServiceError,
        ApiProductPerkValidationError,
        ApiProductServiceError,
      ],
    }),
  )
  /**
   * Detaches a perk from a product. Addressed by the two owning resources
   * rather than the opaque link id, which callers never have to learn.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.delete("detachProductPerk", "/:productId/perks/:perkId", {
      params: { perkId: Schema.String, productId: Schema.String },
      error: [
        ApiActionForbiddenError,
        ApiProductNotFoundError,
        ApiProductPerkNotFoundError,
        ApiProductPerkServiceError,
        ApiProductPerkValidationError,
        ApiProductServiceError,
      ],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/products");
