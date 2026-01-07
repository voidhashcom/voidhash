import { Rpc, RpcGroup } from "@effect/rpc";
import {
  ActionForbiddenError,
  PaywallNotFoundError,
  PaywallServiceError,
  PaywallSlugAlreadyExistsError,
} from "@voidhash/shared";
import { Schema } from "effect";

import { AuthMiddleware } from "../middlewares";

export const Paywall = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  projectId: Schema.String,
  slug: Schema.String,
});

export class PaywallRpcsDef extends RpcGroup.make(
  Rpc.make("ListPaywalls", {
    error: Schema.Union(ActionForbiddenError, PaywallServiceError),
    payload: Schema.Struct({
      projectId: Schema.String,
    }),
    success: Schema.Array(Paywall),
  }),
  Rpc.make("CreatePaywall", {
    error: Schema.Union(
      ActionForbiddenError,
      PaywallServiceError,
      PaywallSlugAlreadyExistsError
    ),
    payload: Schema.Struct({
      name: Schema.String,
      projectId: Schema.String,
      slug: Schema.String,
    }),
    success: Schema.Struct({
      id: Schema.String,
    }),
  }),
  Rpc.make("DeletePaywall", {
    error: Schema.Union(
      ActionForbiddenError,
      PaywallServiceError,
      PaywallNotFoundError
    ),
    payload: Schema.Struct({
      paywallId: Schema.String,
    }),
    success: Schema.Void,
  }),
  Rpc.make("RequestPaywallEditToken", {
    error: Schema.Union(
      ActionForbiddenError,
      PaywallServiceError,
      PaywallNotFoundError
    ),
    payload: Schema.Struct({
      paywallId: Schema.String,
    }),
    success: Schema.Struct({
      expiresAt: Schema.DateFromNumber,
      token: Schema.String,
    }),
  })
).middleware(AuthMiddleware) {}
