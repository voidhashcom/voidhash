import { Rpc, RpcGroup } from "@effect/rpc";
import {
  ActionForbiddenError,
  PaymentProviderAlreadyExistsError,
  PaymentProviderConfigurationKeyUnavailableError,
  PaymentProviderConfigurationNotFoundError,
  PaymentProviderConfigurationServiceError,
  PaymentProviderConfigurationValidationError,
} from "@voidhash/shared";
import { Schema } from "effect";

import { AuthMiddleware } from "../middlewares";

export const PaymentProviderConfiguration = Schema.Struct({
  configuration: Schema.NullOr(Schema.Object),
  createdAt: Schema.NullOr(Schema.Date),
  deletedAt: Schema.NullOr(Schema.Date),
  enabled: Schema.Boolean,
  id: Schema.String,
  name: Schema.String,
  paymentProviderKey: Schema.String,
  projectId: Schema.String,
  providerId: Schema.String,
  updatedAt: Schema.NullOr(Schema.Date),
});

export class PaymentProviderConfigurationRpcsDef extends RpcGroup.make(
  Rpc.make("ListPaymentProviderConfigurations", {
    error: Schema.Union(
      ActionForbiddenError,
      PaymentProviderConfigurationServiceError
    ),
    payload: Schema.Struct({
      projectId: Schema.String,
    }),
    success: Schema.Array(PaymentProviderConfiguration),
  }),
  Rpc.make("GetPaymentProviderConfiguration", {
    error: Schema.Union(
      ActionForbiddenError,
      PaymentProviderConfigurationServiceError,
      PaymentProviderConfigurationNotFoundError
    ),
    payload: Schema.Struct({
      id: Schema.String,
    }),
    success: PaymentProviderConfiguration,
  }),
  Rpc.make("CreatePaymentProviderConfiguration", {
    error: Schema.Union(
      ActionForbiddenError,
      PaymentProviderConfigurationServiceError,
      PaymentProviderAlreadyExistsError,
      PaymentProviderConfigurationValidationError
    ),
    payload: Schema.Struct({
      projectId: Schema.String,
      providerId: Schema.String,
    }),
    success: Schema.Struct({
      id: Schema.String,
    }),
  }),
  Rpc.make("UpdatePaymentProviderConfiguration", {
    error: Schema.Union(
      ActionForbiddenError,
      PaymentProviderConfigurationValidationError,
      PaymentProviderConfigurationServiceError,
      PaymentProviderConfigurationNotFoundError,
      PaymentProviderConfigurationKeyUnavailableError
    ),
    payload: Schema.Struct({
      configuration: Schema.Record({
        key: Schema.String,
        value: Schema.Unknown,
      }),
      enabled: Schema.Boolean,
      id: Schema.String,
      name: Schema.String,
    }),
    success: Schema.Struct({
      id: Schema.String,
    }),
  }),
  Rpc.make("DeletePaymentProviderConfiguration", {
    error: Schema.Union(
      ActionForbiddenError,
      PaymentProviderConfigurationServiceError,
      PaymentProviderConfigurationNotFoundError
    ),
    payload: Schema.Struct({
      paymentProviderConfigurationId: Schema.String,
    }),
    success: Schema.Void,
  })
).middleware(AuthMiddleware) {}
