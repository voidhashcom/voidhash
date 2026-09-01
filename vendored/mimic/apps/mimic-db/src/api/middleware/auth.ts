import * as Encoding from "effect/Encoding";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { AuthMiddleware, CurrentUser, UnauthorizedError } from "@voidhash/mimic-server/rpc";

import { HostServiceTag } from "../../app/hostService.ts";

interface BasicCredentials {
  readonly username: string;
  readonly password: string;
}

const parseBasicAuth = (
  header: Option.Option<string>,
): Effect.Effect<BasicCredentials, UnauthorizedError> =>
  Effect.gen(function* () {
    if (Option.isNone(header) || !header.value.startsWith("Basic ")) {
      return yield* new UnauthorizedError({
        code: "unauthorized",
        message: "Authentication required. Provide Authorization: Basic header.",
      });
    }

    const decoded = yield* Effect.fromResult(
      Encoding.decodeBase64String(header.value.slice(6)),
    ).pipe(
      Effect.mapError(
        () =>
          new UnauthorizedError({
            code: "unauthorized",
            message: "Invalid Basic auth header format",
          }),
      ),
    );
    const separator = decoded.indexOf(":");
    if (separator <= 0) {
      return yield* new UnauthorizedError({
        code: "unauthorized",
        message: "Invalid Basic auth header format",
      });
    }

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  });

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
        const auth = headers["authorization"] ?? headers["Authorization"];
        const { username, password } = yield* parseBasicAuth(Option.fromUndefinedOr(auth));
        const user = yield* host.authenticateBasic(username, password);
        return yield* Effect.provideService(effect, CurrentUser, user);
      });
  }),
);
