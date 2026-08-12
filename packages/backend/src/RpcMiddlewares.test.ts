import { ApiKeyNotFoundError } from "@voidhash/core/domain/apiKey/ApiKey";
import {
  ApiKeyService,
  type UserApiKeyWithUser,
} from "@voidhash/core/services/apiKeys/ApiKeyService";
import { AuthTokenVerifier } from "@voidhash/core/services/auth/AuthTokenVerifier";
import { IdentityProvider } from "@voidhash/core/services/auth/IdentityProvider";
import { LocalUserSessionService } from "@voidhash/core/services/auth/LocalUserSessionService";
import { Db, type User as DbUser } from "@voidhash/db";
import { RpcNotAuthenticatedError, type UserSession } from "@voidhash/rpc";
import { DateTime, Effect } from "effect";
import * as HttpHeaders from "effect/unstable/http/Headers";
import { describe, expect, it } from "vite-plus/test";

import { makeRpcSessionResolver } from "./RpcMiddlewares.ts";

function serviceStub<T>(methods: Partial<T>): T;
function serviceStub<T>(methods: Partial<T>) {
  return methods;
}

const epoch = DateTime.toDateUtc(DateTime.makeUnsafe(0));

const dbUser = {
  banExpires: null,
  banned: false,
  banReason: null,
  createdAt: epoch,
  customImageUrl: null,
  email: "smoke@example.com",
  emailVerified: true,
  id: "user_1",
  image: null,
  name: "Smoke User",
  role: null,
  updatedAt: epoch,
  workosUserId: null,
} satisfies DbUser;

const userSession = {
  cookie: null,
  method: "user",
  name: "Smoke User",
  organizations: [],
  person: null,
  projects: [],
  user: {
    createdAt: dbUser.createdAt,
    email: dbUser.email,
    emailVerified: dbUser.emailVerified,
    id: dbUser.id,
    image: dbUser.image,
    name: dbUser.name,
    role: dbUser.role,
    updatedAt: dbUser.updatedAt,
    workosUserId: dbUser.workosUserId,
  },
} satisfies UserSession;

const authTokenVerifier = AuthTokenVerifier.of({
  validateToken: () => Effect.die("bearer authentication must not run"),
});

const identityProvider = serviceStub<IdentityProvider["Service"]>({});
const db = serviceStub<Db["Service"]>({});

const resolveWithApiKey = (validateUserApiKey: ApiKeyService["Service"]["validateUserApiKey"]) =>
  Effect.gen(function* () {
    const resolve = yield* makeRpcSessionResolver(authTokenVerifier);
    return yield* resolve(HttpHeaders.fromInput({ "x-api-key": "smoke-key" }));
  }).pipe(
    Effect.provideService(ApiKeyService)(
      serviceStub<ApiKeyService["Service"]>({ validateUserApiKey }),
    ),
    Effect.provideService(LocalUserSessionService)(
      serviceStub<LocalUserSessionService["Service"]>({
        loadUserAccess: () => Effect.succeed({ organizations: [], projects: [] }),
        toUserSession: () => userSession,
      }),
    ),
    Effect.provideService(IdentityProvider)(identityProvider),
    Effect.provideService(Db)(db),
  );

describe("makeRpcSessionResolver", () => {
  it("authenticates an RPC request with a user API key", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const session = yield* resolveWithApiKey(() =>
          Effect.succeed(
            serviceStub<UserApiKeyWithUser>({
              user: dbUser,
            }),
          ),
        );
        expect(session).toEqual(userSession);
      }),
    ));

  it("rejects an invalid user API key without trying bearer authentication", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          resolveWithApiKey(() => Effect.fail(new ApiKeyNotFoundError({}))),
        );
        expect(error).toBeInstanceOf(RpcNotAuthenticatedError);
      }),
    ));
});
