import { Rpc, RpcGroup } from '@effect/rpc';
import {
  ActionForbiddenError,
  PaymentProviderAlreadyExistsError,
  PaymentProviderConfigurationKeyUnavailableError,
  PaymentProviderConfigurationNotFoundError,
  PaymentProviderConfigurationServiceError,
  PaymentProviderConfigurationValidationError
} from '@voidhash/shared';
import { Schema } from 'effect';
import { AuthMiddleware } from '../middlewares';

export const PaymentProviderConfiguration = Schema.Struct({
  name: Schema.String,
  id: Schema.String,
  createdAt: Schema.NullOr(Schema.Date),
  updatedAt: Schema.NullOr(Schema.Date),
  projectId: Schema.String,
  providerId: Schema.String,
  paymentProviderKey: Schema.String,
  enabled: Schema.Boolean,
  configuration: Schema.NullOr(Schema.Object),
  deletedAt: Schema.NullOr(Schema.Date)
});

export class PaymentProviderConfigurationRpcsDef extends RpcGroup.make(
  Rpc.make('ListPaymentProviderConfigurations', {
    payload: Schema.Struct({
      projectId: Schema.String
    }),
    success: Schema.Array(PaymentProviderConfiguration),
    error: Schema.Union(
      ActionForbiddenError,
      PaymentProviderConfigurationServiceError
    )
  }),
  Rpc.make('GetPaymentProviderConfiguration', {
    payload: Schema.Struct({
      id: Schema.String
    }),
    success: PaymentProviderConfiguration,
    error: Schema.Union(
      ActionForbiddenError,
      PaymentProviderConfigurationServiceError,
      PaymentProviderConfigurationNotFoundError
    )
  }),
  Rpc.make('CreatePaymentProviderConfiguration', {
    payload: Schema.Struct({
      projectId: Schema.String,
      providerId: Schema.String
    }),
    success: Schema.Struct({
      id: Schema.String
    }),
    error: Schema.Union(
      ActionForbiddenError,
      PaymentProviderConfigurationServiceError,
      PaymentProviderAlreadyExistsError,
      PaymentProviderConfigurationValidationError
    )
  }),
  Rpc.make('UpdatePaymentProviderConfiguration', {
    payload: Schema.Struct({
      id: Schema.String,
      enabled: Schema.Boolean,
      name: Schema.String,
      configuration: Schema.Record({
        key: Schema.String,
        value: Schema.Unknown
      })
    }),
    success: Schema.Struct({
      id: Schema.String
    }),
    error: Schema.Union(
      ActionForbiddenError,
      PaymentProviderConfigurationValidationError,
      PaymentProviderConfigurationServiceError,
      PaymentProviderConfigurationNotFoundError,
      PaymentProviderConfigurationKeyUnavailableError
    )
  }),
  Rpc.make('DeletePaymentProviderConfiguration', {
    payload: Schema.Struct({
      paymentProviderConfigurationId: Schema.String
    }),
    success: Schema.Void,
    error: Schema.Union(
      ActionForbiddenError,
      PaymentProviderConfigurationServiceError,
      PaymentProviderConfigurationNotFoundError
    )
  })
).middleware(AuthMiddleware) {}
