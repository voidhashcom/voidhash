import { RpcMiddleware } from "@effect/rpc/index";
import {
  AuthSession,
  AuthenticationError,
  NotAuthenticatedError,
} from "@voidhash/shared";
import { Schema } from "effect";

export class AuthMiddleware extends RpcMiddleware.Tag<AuthMiddleware>()(
  "Rpc/AuthenticationMiddleware",
  {
    failure: Schema.Union(AuthenticationError, NotAuthenticatedError),
    provides: AuthSession,
    requiredForClient: false,
  }
) {}
