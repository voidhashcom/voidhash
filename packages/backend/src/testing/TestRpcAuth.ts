import { LocalUserSessionService } from "@voidhash/core/services";
import { Db } from "@voidhash/db";
import {
  AuthMiddleware,
  AuthSession,
  RpcAuthenticationError,
  RpcNotAuthenticatedError,
  type UserSession,
} from "@voidhash/rpc";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as HttpHeaders from "effect/unstable/http/Headers";

import { makeSmokeIds, SMOKE_ROLE_HEADER, SMOKE_RUN_ID_HEADER } from "./smoke-ids.ts";

type SmokeRole = "admin" | "user";

const headerValue = (headers: HttpHeaders.Headers, name: string) =>
  Option.getOrUndefined(HttpHeaders.get(headers, name));

const readSmokeHeaders = (
  headers: HttpHeaders.Headers,
): Effect.Effect<{ readonly role: SmokeRole; readonly runId: string }, RpcNotAuthenticatedError> =>
  Effect.gen(function* () {
    const runId = headerValue(headers, SMOKE_RUN_ID_HEADER);
    const role = headerValue(headers, SMOKE_ROLE_HEADER);

    if (!runId) {
      return yield* Effect.fail(
        new RpcNotAuthenticatedError({ message: `Missing ${SMOKE_RUN_ID_HEADER}` }),
      );
    }

    if (role !== "admin" && role !== "user") {
      return yield* Effect.fail(
        new RpcNotAuthenticatedError({ message: `Missing or invalid ${SMOKE_ROLE_HEADER}` }),
      );
    }

    return { role, runId };
  });

const loadSession = (
  localUserSessions: typeof LocalUserSessionService.Service,
  headers: HttpHeaders.Headers,
): Effect.Effect<UserSession, RpcAuthenticationError | RpcNotAuthenticatedError, Db> =>
  Effect.gen(function* () {
    const { role, runId } = yield* readSmokeHeaders(headers);
    const ids = makeSmokeIds(runId);
    const userId = role === "admin" ? ids.adminUserId : ids.normalUserId;

    const dbUser = yield* localUserSessions.getLocalUser(userId).pipe(
      Effect.catchTag("EffectDrizzleQueryError", (error) =>
        Effect.fail(
          new RpcAuthenticationError({
            cause: String(error.cause),
            message: "Failed to authenticate due to a database error",
          }),
        ),
      ),
    );

    if (!dbUser) {
      return yield* Effect.fail(
        new RpcNotAuthenticatedError({ message: `Seeded test user not found: ${userId}` }),
      );
    }

    const access = yield* localUserSessions.loadUserAccess(userId).pipe(
      Effect.catchTag("EffectDrizzleQueryError", (error) =>
        Effect.fail(
          new RpcAuthenticationError({
            cause: String(error.cause),
            message: "Failed to authenticate due to a database error",
          }),
        ),
      ),
    );

    return localUserSessions.toUserSession(dbUser, access, null, `workos_${userId}`);
  });

export const TestRpcAuthLive = Layer.effect(
  AuthMiddleware,
  Effect.gen(function* () {
    const localUserSessions = yield* LocalUserSessionService;
    const db = yield* Db;
    return AuthMiddleware.of((effect, { headers }) =>
      Effect.provideService(loadSession(localUserSessions, headers), Db, db).pipe(
        Effect.flatMap((session) => Effect.provideService(effect, AuthSession, session)),
      ),
    );
  }),
);
