import { Buffer } from "node:buffer";

import { Effect, Layer } from "effect";
import { AuthMiddleware, CurrentUser, UnauthorizedError } from "@voidhash/mimic-server/rpc";

import { HostServiceTag } from "../../app/hostService.ts";

interface BasicCredentials {
  readonly username: string;
  readonly password: string;
}

const parseBasicAuth = (header: string | undefined): BasicCredentials => {
  if (!header?.startsWith("Basic ")) {
    throw new UnauthorizedError({
      code: "unauthorized",
      message: "Authentication required. Provide Authorization: Basic header.",
    });
  }

  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator <= 0) {
    throw new UnauthorizedError({
      code: "unauthorized",
      message: "Invalid Basic auth header format",
    });
  }

  return {
    username: decoded.slice(0, separator),
    password: decoded.slice(separator + 1),
  };
};

/**
 * Server-side implementation of `AuthMiddleware`.
 *
 * Reads the `Authorization` header from the per-RPC headers (the RPC server
 * merges the underlying HTTP request's headers into the per-RPC headers
 * before invoking middleware), parses Basic auth, and provides the resolved
 * `CurrentUser` to the wrapped handler effect. Failures surface as the
 * tagged `UnauthorizedError` declared on the middleware contract.
 */
export const AuthMiddlewareLive = Layer.effect(AuthMiddleware)(
  Effect.gen(function* () {
    const host = yield* HostServiceTag;

    return (effect, { headers }) =>
      Effect.gen(function* () {
        const auth =
          (headers as Record<string, string | undefined>)["authorization"] ??
          (headers as Record<string, string | undefined>)["Authorization"];
        const { username, password } = yield* Effect.sync(() => parseBasicAuth(auth));
        const user = yield* host.authenticateBasic(username, password);
        return yield* Effect.provideService(effect, CurrentUser, user);
      });
  }),
);
