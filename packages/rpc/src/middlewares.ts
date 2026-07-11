import { RpcMiddleware } from "effect/unstable/rpc";
import { Schema } from "effect";

import { AuthSession } from "./auth.ts";
import {
  RpcAuthenticationError,
  RpcNotAuthenticatedError,
} from "./errors/common.ts";

export class AuthMiddleware extends RpcMiddleware.Service<
  AuthMiddleware,
  {
    provides: AuthSession;
  }
>()("Rpc/AuthenticationMiddleware", {
  error: Schema.Union([RpcAuthenticationError, RpcNotAuthenticatedError]),
  requiredForClient: false,
}) {}
