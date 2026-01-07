import { Rpc, RpcGroup } from "@effect/rpc";
import {
  ActionForbiddenError,
  PaymentProviderProductNotFoundError,
  PaymentProviderProductServiceError,
  PaymentProviderProductValidationError,
} from "@voidhash/shared";
import { Schema } from "effect";

import { AuthMiddleware } from "../middlewares";

export const PaymentProviderProduct = Schema.Struct({
  configuration: Schema.NullOr(Schema.Object),
  createdAt: Schema.NullOr(Schema.Date),
  id: Schema.String,
  isActive: Schema.Boolean,
  paymentProviderConfigurationId: Schema.String,
  productId: Schema.String,
  providerProductKey: Schema.String,
  updatedAt: Schema.NullOr(Schema.Date),
});

export class PaymentProviderProductRpcsDef extends RpcGroup.make(
  Rpc.make("ListProviderProductsByProductId", {
    error: Schema.Union(
      ActionForbiddenError,
      PaymentProviderProductValidationError,
      PaymentProviderProductServiceError
    ),
    payload: Schema.Struct({
      productId: Schema.String,
    }),
    success: Schema.Array(PaymentProviderProduct),
  }),
  Rpc.make("CreatePaymentProviderProduct", {
    error: Schema.Union(
      ActionForbiddenError,
      PaymentProviderProductValidationError,
      PaymentProviderProductServiceError
    ),
    payload: Schema.Struct({
      configuration: Schema.Record({
        key: Schema.String,
        value: Schema.Unknown,
      }),
      paymentProviderConfigurationId: Schema.String,
      productId: Schema.String,
    }),
    success: Schema.Struct({
      id: Schema.String,
    }),
  }),
  Rpc.make("UpdatePaymentProviderProduct", {
    error: Schema.Union(
      ActionForbiddenError,
      PaymentProviderProductValidationError,
      PaymentProviderProductNotFoundError,
      PaymentProviderProductServiceError
    ),
    payload: Schema.Struct({
      configuration: Schema.Record({
        key: Schema.String,
        value: Schema.Unknown,
      }),
      id: Schema.String,
    }),
    success: Schema.Void,
  }),
  Rpc.make("DeletePaymentProviderProduct", {
    error: Schema.Union(
      ActionForbiddenError,
      PaymentProviderProductValidationError,
      PaymentProviderProductServiceError
    ),
    payload: Schema.Struct({
      id: Schema.String,
    }),
    success: Schema.Void,
  }),
  Rpc.make("SetActivePaymentProviderProduct", {
    error: Schema.Union(
      ActionForbiddenError,
      PaymentProviderProductValidationError,
      PaymentProviderProductServiceError
    ),
    payload: Schema.Struct({
      paymentProviderConfigurationId: Schema.String,
      productId: Schema.String,
      providerProductKey: Schema.String,
    }),
    success: Schema.Void,
  })
).middleware(AuthMiddleware) {}
