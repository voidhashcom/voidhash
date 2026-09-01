import * as Schema from "effect/Schema";
import * as Arr from "effect/Array";
import {
  createdResponse,
  PaymentProviderProduct,
  PaymentProviderProductDetail,
  VoidhashV1Api,
} from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiPaymentProviderProductNotFoundError,
  ApiPaymentProviderProductServiceError,
  ApiPaymentProviderProductValidationError,
} from "@voidhash/api-contracts/errors";
import { PaymentProviderProductService } from "@voidhash/core-v2";
import { paginate, resolveRequestProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import {
  type ApiCredentialMethod,
  bridgeAuthSession,
  requireCredential,
} from "../../ApiMiddlewares.ts";
import * as P from "effect/Predicate";

/** Catalog wiring is a management concern; publishable keys are rejected. */
const MANAGEMENT_CREDENTIALS: ReadonlyArray<ApiCredentialMethod> = ["user", "secret-key"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  P.isObject(value) && value !== null;

const toConfiguration = (value: unknown): Record<string, unknown> => {
  if (isRecord(value)) return value;
  return {};
};

interface ProviderProductRow {
  readonly configuration: unknown;
  readonly createdAt: Date | typeof Schema.Null.Type;
  readonly id: string;
  readonly isActive: boolean;
  readonly paymentProviderConfigurationId: string;
  readonly productId: string;
  readonly providerProductKey: string;
  readonly updatedAt: Date | typeof Schema.Null.Type;
}

/** Single-mapping projection; the collection listing cannot supply these fields. */
const toDetail = (row: ProviderProductRow) => ({
  configuration: toConfiguration(row.configuration),
  createdAt: row.createdAt,
  id: row.id,
  isActive: row.isActive,
  paymentProviderConfigurationId: row.paymentProviderConfigurationId,
  productId: row.productId,
  providerProductKey: row.providerProductKey,
  updatedAt: row.updatedAt,
});

export const PaymentProviderProductsGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "payment_provider_products",
  (handlers) =>
    Effect.gen(function* () {
      const service = yield* PaymentProviderProductService;

      return handlers
        .handle("listPaymentProviderProducts", ({ query }) =>
          bridgeAuthSession(
            Effect.fn("PaymentProviderProductsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
              const rows = yield* service.getProviderProductsByProjectId(projectId);
              // Both narrowings are applied over the project-scoped read so a
              // caller can never address a mapping outside its own project.
              const matching = rows.filter(
                (row) =>
                  (query.productId === undefined || row.productId === query.productId) &&
                  (query.paymentProviderConfigurationId === undefined ||
                    row.paymentProviderConfigurationId === query.paymentProviderConfigurationId),
              );
              const sorted = Arr.sortWith([...matching], (item) => item.id, Order.String);
              const page = yield* paginate(sorted, (row) => row.id, query);
              return {
                data: page.data.map(
                  (row) =>
                    new PaymentProviderProduct({
                      configuration: toConfiguration(row.configuration),
                      id: row.id,
                      paymentProviderConfigurationId: row.paymentProviderConfigurationId,
                      productId: row.productId,
                      providerId: row.providerId,
                    }),
                ),
                pageInfo: page.pageInfo,
              };
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PurchaseActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PaymentProviderProductServiceError: (e) =>
                Effect.fail(new ApiPaymentProviderProductServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("createPaymentProviderProduct", ({ payload }) =>
          bridgeAuthSession(
            Effect.fn("PaymentProviderProductsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              const created = yield* service.createPaymentProviderProduct({
                configuration: payload.configuration,
                paymentProviderConfigurationId: payload.paymentProviderConfigurationId,
                productId: payload.productId,
              });
              const row = yield* service.getProviderProductById(created.id);
              const detail = toDetail(row);
              return yield* createdResponse(
                PaymentProviderProductDetail,
                detail,
                `/payment-provider-products/${detail.id}`,
              );
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PurchaseActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PaymentProviderProductNotFoundError: (e) =>
                Effect.fail(new ApiPaymentProviderProductNotFoundError({ message: e.message })),
              PaymentProviderProductServiceError: (e) =>
                Effect.fail(new ApiPaymentProviderProductServiceError({ cause: e.cause })),
              PaymentProviderProductValidationError: (e) =>
                Effect.fail(new ApiPaymentProviderProductValidationError({ message: e.message })),
            }),
          ),
        )
        .handle("getPaymentProviderProduct", ({ params }) =>
          bridgeAuthSession(
            Effect.fn("PaymentProviderProductsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              const row = yield* service.getProviderProductById(params.mappingId);
              return toDetail(row);
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PurchaseActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PaymentProviderProductNotFoundError: (e) =>
                Effect.fail(new ApiPaymentProviderProductNotFoundError({ message: e.message })),
              PaymentProviderProductServiceError: (e) =>
                Effect.fail(new ApiPaymentProviderProductServiceError({ cause: e.cause })),
              PaymentProviderProductValidationError: (e) =>
                Effect.fail(new ApiPaymentProviderProductValidationError({ message: e.message })),
            }),
          ),
        )
        .handle("updatePaymentProviderProduct", ({ params, payload }) =>
          bridgeAuthSession(
            Effect.fn("PaymentProviderProductsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              yield* service.updatePaymentProviderProduct({
                configuration: payload.configuration,
                id: params.mappingId,
              });
              const row = yield* service.getProviderProductById(params.mappingId);
              return toDetail(row);
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PurchaseActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PaymentProviderProductNotFoundError: (e) =>
                Effect.fail(new ApiPaymentProviderProductNotFoundError({ message: e.message })),
              PaymentProviderProductServiceError: (e) =>
                Effect.fail(new ApiPaymentProviderProductServiceError({ cause: e.cause })),
              PaymentProviderProductValidationError: (e) =>
                Effect.fail(new ApiPaymentProviderProductValidationError({ message: e.message })),
            }),
          ),
        )
        .handle("deletePaymentProviderProduct", ({ params }) =>
          bridgeAuthSession(
            Effect.fn("PaymentProviderProductsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              return yield* service.deletePaymentProviderProduct({ id: params.mappingId });
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PurchaseActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PaymentProviderProductServiceError: (e) =>
                Effect.fail(new ApiPaymentProviderProductServiceError({ cause: e.cause })),
              PaymentProviderProductValidationError: (e) =>
                Effect.fail(new ApiPaymentProviderProductValidationError({ message: e.message })),
            }),
          ),
        )
        .handle("activatePaymentProviderProduct", ({ params }) =>
          bridgeAuthSession(
            Effect.fn("PaymentProviderProductsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              // The natural key the service expects already lives on the row,
              // so the mapping id is sufficient to identify the promotion.
              const existing = yield* service.getProviderProductById(params.mappingId);
              yield* service.setActivePaymentProviderProduct({
                paymentProviderConfigurationId: existing.paymentProviderConfigurationId,
                productId: existing.productId,
                providerProductKey: existing.providerProductKey,
              });
              const row = yield* service.getProviderProductById(params.mappingId);
              return toDetail(row);
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PurchaseActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PaymentProviderProductNotFoundError: (e) =>
                Effect.fail(new ApiPaymentProviderProductNotFoundError({ message: e.message })),
              PaymentProviderProductServiceError: (e) =>
                Effect.fail(new ApiPaymentProviderProductServiceError({ cause: e.cause })),
              PaymentProviderProductValidationError: (e) =>
                Effect.fail(new ApiPaymentProviderProductValidationError({ message: e.message })),
            }),
          ),
        );
    }),
);
