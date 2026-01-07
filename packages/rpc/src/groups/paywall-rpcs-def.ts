import { Rpc, RpcGroup } from '@effect/rpc';
import {
  ActionForbiddenError,
  PaywallNotFoundError,
  PaywallServiceError,
  PaywallSlugAlreadyExistsError
} from '@voidhash/shared';
import { Schema } from 'effect';
import { AuthMiddleware } from '../middlewares';

export const Paywall = Schema.Struct({
  id: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  projectId: Schema.String
});

export class PaywallRpcsDef extends RpcGroup.make(
  Rpc.make('ListPaywalls', {
    payload: Schema.Struct({
      projectId: Schema.String
    }),
    success: Schema.Array(Paywall),
    error: Schema.Union(ActionForbiddenError, PaywallServiceError)
  }),
  Rpc.make('CreatePaywall', {
    payload: Schema.Struct({
      projectId: Schema.String,
      name: Schema.String,
      slug: Schema.String
    }),
    success: Schema.Struct({
      id: Schema.String
    }),
    error: Schema.Union(
      ActionForbiddenError,
      PaywallServiceError,
      PaywallSlugAlreadyExistsError
    )
  }),
  Rpc.make('DeletePaywall', {
    payload: Schema.Struct({
      paywallId: Schema.String
    }),
    success: Schema.Void,
    error: Schema.Union(
      ActionForbiddenError,
      PaywallServiceError,
      PaywallNotFoundError
    )
  }),
  Rpc.make('RequestPaywallEditToken', {
    payload: Schema.Struct({
      paywallId: Schema.String
    }),
    success: Schema.Struct({
      token: Schema.String,
      expiresAt: Schema.DateFromNumber
    }),
    error: Schema.Union(
      ActionForbiddenError,
      PaywallServiceError,
      PaywallNotFoundError
    )
  })
).middleware(AuthMiddleware) {}
