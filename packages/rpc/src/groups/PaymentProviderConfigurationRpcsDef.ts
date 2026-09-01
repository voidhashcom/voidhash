import { Rpc, RpcGroup } from "effect/unstable/rpc";
import * as Schema from "effect/Schema";

import { RpcActionForbiddenError } from "../errors/common.ts";
import {
  RpcPaymentProviderAlreadyExistsError,
  RpcPaymentProviderConfigurationInUseError,
  RpcPaymentProviderConfigurationKeyUnavailableError,
  RpcPaymentProviderConfigurationNotFoundError,
  RpcPaymentProviderConfigurationServiceError,
  RpcPaymentProviderConfigurationValidationError,
} from "../errors/PaymentProviderConfiguration.ts";
import { AuthMiddleware } from "../middlewares.ts";

export const PaymentProviderConfiguration = Schema.Struct({
  activeProviderId: Schema.NullOr(Schema.String),
  configuration: Schema.NullOr(Schema.ObjectKeyword),
  createdAt: Schema.NullOr(Schema.Date),
  deletedAt: Schema.NullOr(Schema.Date),
  isEnabled: Schema.Boolean,
  id: Schema.String,
  name: Schema.String,
  paymentProviderKey: Schema.String,
  projectId: Schema.String,
  providerId: Schema.String,
  updatedAt: Schema.NullOr(Schema.Date),
}).pipe(Schema.encodeKeys({ isEnabled: "enabled" }));
export type PaymentProviderConfiguration = typeof PaymentProviderConfiguration.Type;

export class PaymentProviderConfigurationRpcsDef extends RpcGroup.make(
  Rpc.make("ListPaymentProviderConfigurations", {
    error: Schema.Union([RpcActionForbiddenError, RpcPaymentProviderConfigurationServiceError]),
    payload: Schema.Struct({
      projectId: Schema.String,
    }),
    success: Schema.Array(PaymentProviderConfiguration),
  }),
  Rpc.make("GetPaymentProviderConfiguration", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcPaymentProviderConfigurationServiceError,
      RpcPaymentProviderConfigurationNotFoundError,
    ]),
    payload: Schema.Struct({
      id: Schema.String,
    }),
    success: PaymentProviderConfiguration,
  }),
  Rpc.make("CreatePaymentProviderConfiguration", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcPaymentProviderConfigurationServiceError,
      RpcPaymentProviderAlreadyExistsError,
      RpcPaymentProviderConfigurationValidationError,
    ]),
    payload: Schema.Struct({
      projectId: Schema.String,
      providerId: Schema.String,
    }),
    success: Schema.Struct({
      id: Schema.String,
    }),
  }),
  Rpc.make("UpdatePaymentProviderConfiguration", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcPaymentProviderConfigurationValidationError,
      RpcPaymentProviderConfigurationServiceError,
      RpcPaymentProviderConfigurationNotFoundError,
      RpcPaymentProviderConfigurationKeyUnavailableError,
    ]),
    payload: Schema.Struct({
      configuration: Schema.Record(Schema.String, Schema.Unknown),
      isEnabled: Schema.Boolean,
      id: Schema.String,
      name: Schema.String,
    }).pipe(Schema.encodeKeys({ isEnabled: "enabled" })),
    success: Schema.Struct({
      id: Schema.String,
    }),
  }),
  Rpc.make("DeletePaymentProviderConfiguration", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcPaymentProviderConfigurationServiceError,
      RpcPaymentProviderConfigurationNotFoundError,
      RpcPaymentProviderConfigurationInUseError,
    ]),
    payload: Schema.Struct({
      paymentProviderConfigurationId: Schema.String,
    }),
    success: Schema.Void,
  }),
).middleware(AuthMiddleware) {}
