import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import {
  ApiActionForbiddenError,
  ApiPaymentProviderProductNotFoundError,
  ApiPaymentProviderProductServiceError,
  ApiPaymentProviderProductValidationError,
} from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import { paginated } from "../Pagination.ts";
import { PaymentProviderProduct } from "../Schema.ts";
import {
  CreatePaymentProviderProductBody,
  ListPaymentProviderProductsQuery,
  PaymentProviderProductDetail,
  UpdatePaymentProviderProductBody,
} from "../schemas/providers.ts";

/**
 * Mappings between a Voidhash product and a provider's product identifier.
 *
 * Secret-key or user credential; publishable keys are rejected. Exactly one
 * mapping per (product, provider configuration) is active at a time — that is
 * the one the purchase pipeline resolves.
 */
export const PaymentProviderProductsGroup = HttpApiGroup.make("payment_provider_products")
  .add(
    // Mappings in the resolved project, optionally narrowed to one product or
    // one provider configuration.
    HttpApiEndpoint.get("listPaymentProviderProducts", "/", {
      query: ListPaymentProviderProductsQuery,
      success: paginated(PaymentProviderProduct),
      error: [ApiActionForbiddenError, ApiPaymentProviderProductServiceError],
    }),
  )
  .add(
    // Creating a mapping makes it the active one for its (product, provider)
    // pair, matching the dashboard's "add and use" behaviour.
    HttpApiEndpoint.post("createPaymentProviderProduct", "/", {
      payload: CreatePaymentProviderProductBody,
      success: PaymentProviderProductDetail.pipe(HttpApiSchema.status(201)),
      error: [
        ApiActionForbiddenError,
        ApiPaymentProviderProductNotFoundError,
        ApiPaymentProviderProductServiceError,
        ApiPaymentProviderProductValidationError,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.get("getPaymentProviderProduct", "/:mappingId", {
      params: { mappingId: Schema.String },
      success: PaymentProviderProductDetail,
      error: [
        ApiActionForbiddenError,
        ApiPaymentProviderProductNotFoundError,
        ApiPaymentProviderProductServiceError,
        ApiPaymentProviderProductValidationError,
      ],
    }),
  )
  .add(
    // Last-writer-wins on the provider configuration blob.
    HttpApiEndpoint.patch("updatePaymentProviderProduct", "/:mappingId", {
      params: { mappingId: Schema.String },
      payload: UpdatePaymentProviderProductBody,
      success: PaymentProviderProductDetail,
      error: [
        ApiActionForbiddenError,
        ApiPaymentProviderProductNotFoundError,
        ApiPaymentProviderProductServiceError,
        ApiPaymentProviderProductValidationError,
      ],
    }),
  )
  .add(
    // Hard delete: a mapping has no archive concept, and purchases reference
    // the resolved product rather than the mapping row.
    HttpApiEndpoint.delete("deletePaymentProviderProduct", "/:mappingId", {
      params: { mappingId: Schema.String },
      error: [
        ApiActionForbiddenError,
        ApiPaymentProviderProductServiceError,
        ApiPaymentProviderProductValidationError,
      ],
    }),
  )
  .add(
    // Promotes this mapping to the active one for its (product, provider)
    // pair; the previously active mapping is demoted in the same transaction.
    HttpApiEndpoint.post("activatePaymentProviderProduct", "/:mappingId/activate", {
      params: { mappingId: Schema.String },
      success: PaymentProviderProductDetail,
      error: [
        ApiActionForbiddenError,
        ApiPaymentProviderProductNotFoundError,
        ApiPaymentProviderProductServiceError,
        ApiPaymentProviderProductValidationError,
      ],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/payment-provider-products");
