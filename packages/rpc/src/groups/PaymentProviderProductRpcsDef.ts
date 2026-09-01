import { Rpc, RpcGroup } from "effect/unstable/rpc";
import * as Schema from "effect/Schema";

import { RpcActionForbiddenError } from "../errors/common.ts";
import {
  RpcPaymentProviderProductNotFoundError,
  RpcPaymentProviderProductServiceError,
  RpcPaymentProviderProductValidationError,
} from "../errors/PaymentProviderProduct.ts";
import { AuthMiddleware } from "../middlewares.ts";

export const PaymentProviderProduct = Schema.Struct({
  configuration: Schema.NullOr(Schema.ObjectKeyword),
  createdAt: Schema.NullOr(Schema.Date),
  id: Schema.String,
  isActive: Schema.Boolean,
  paymentProviderConfigurationId: Schema.String,
  productId: Schema.String,
  providerProductKey: Schema.String,
  updatedAt: Schema.NullOr(Schema.Date),
});
export type PaymentProviderProduct = typeof PaymentProviderProduct.Type;

export class PaymentProviderProductRpcsDef extends RpcGroup.make(
  Rpc.make("ListProviderProductsByProductId", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcPaymentProviderProductValidationError,
      RpcPaymentProviderProductServiceError,
    ]),
    payload: Schema.Struct({
      productId: Schema.String,
    }),
    success: Schema.Array(PaymentProviderProduct),
  }),
  Rpc.make("CreatePaymentProviderProduct", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcPaymentProviderProductValidationError,
      RpcPaymentProviderProductServiceError,
      RpcPaymentProviderProductNotFoundError,
    ]),
    payload: Schema.Struct({
      configuration: Schema.Record(Schema.String, Schema.Unknown),
      paymentProviderConfigurationId: Schema.String,
      productId: Schema.String,
    }),
    success: Schema.Struct({
      id: Schema.String,
    }),
  }),
  Rpc.make("UpdatePaymentProviderProduct", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcPaymentProviderProductValidationError,
      RpcPaymentProviderProductNotFoundError,
      RpcPaymentProviderProductServiceError,
    ]),
    payload: Schema.Struct({
      configuration: Schema.Record(Schema.String, Schema.Unknown),
      id: Schema.String,
    }),
    success: Schema.Void,
  }),
  Rpc.make("DeletePaymentProviderProduct", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcPaymentProviderProductValidationError,
      RpcPaymentProviderProductServiceError,
    ]),
    payload: Schema.Struct({
      id: Schema.String,
    }),
    success: Schema.Void,
  }),
  Rpc.make("SetActivePaymentProviderProduct", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcPaymentProviderProductValidationError,
      RpcPaymentProviderProductServiceError,
    ]),
    payload: Schema.Struct({
      paymentProviderConfigurationId: Schema.String,
      productId: Schema.String,
      providerProductKey: Schema.String,
    }),
    success: Schema.Void,
  }),
).middleware(AuthMiddleware) {}
