import { Rpc, RpcGroup } from '@effect/rpc';
import {
  ActionForbiddenError,
  PaymentProviderProductNotFoundError,
  PaymentProviderProductServiceError,
  PaymentProviderProductValidationError
} from '@voidhash/shared';
import { Schema } from 'effect';
import { AuthMiddleware } from '../middlewares';

export const PaymentProviderProduct = Schema.Struct({
  id: Schema.String,
  createdAt: Schema.NullOr(Schema.Date),
  updatedAt: Schema.NullOr(Schema.Date),
  configuration: Schema.NullOr(Schema.Object),
  paymentProviderConfigurationId: Schema.String,
  providerProductKey: Schema.String,
  productId: Schema.String,
  isActive: Schema.Boolean
});

export class PaymentProviderProductRpcsDef extends RpcGroup.make(
  Rpc.make('ListProviderProductsByProductId', {
    payload: Schema.Struct({
      productId: Schema.String
    }),
    success: Schema.Array(PaymentProviderProduct),
    error: Schema.Union(
      ActionForbiddenError,
      PaymentProviderProductValidationError,
      PaymentProviderProductServiceError
    )
  }),
  Rpc.make('CreatePaymentProviderProduct', {
    payload: Schema.Struct({
      productId: Schema.String,
      paymentProviderConfigurationId: Schema.String,
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
      PaymentProviderProductValidationError,
      PaymentProviderProductServiceError
    )
  }),
  Rpc.make('UpdatePaymentProviderProduct', {
    payload: Schema.Struct({
      id: Schema.String,
      configuration: Schema.Record({
        key: Schema.String,
        value: Schema.Unknown
      })
    }),
    success: Schema.Void,
    error: Schema.Union(
      ActionForbiddenError,
      PaymentProviderProductValidationError,
      PaymentProviderProductNotFoundError,
      PaymentProviderProductServiceError
    )
  }),
  Rpc.make('DeletePaymentProviderProduct', {
    payload: Schema.Struct({
      id: Schema.String
    }),
    success: Schema.Void,
    error: Schema.Union(
      ActionForbiddenError,
      PaymentProviderProductValidationError,
      PaymentProviderProductServiceError
    )
  }),
  Rpc.make('SetActivePaymentProviderProduct', {
    payload: Schema.Struct({
      productId: Schema.String,
      paymentProviderConfigurationId: Schema.String,
      providerProductKey: Schema.String
    }),
    success: Schema.Void,
    error: Schema.Union(
      ActionForbiddenError,
      PaymentProviderProductValidationError,
      PaymentProviderProductServiceError
    )
  })
).middleware(AuthMiddleware) {}
