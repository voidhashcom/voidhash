import { resolveUserSession } from "@voidhash/backend/AuthSessionResolver";
import { AuthTokenVerifier } from "@voidhash/core/services/auth/AuthTokenVerifier";
import { LocalUserSessionService } from "@voidhash/core/services/auth/LocalUserSessionService";
import {
  STANDALONE_AUTH_COOKIE_NAME,
  STANDALONE_ROOT_SUBJECT,
  signStandaloneAuthToken,
} from "@voidhash/core/utils/crypto/standalone-auth-token";
import { Db, eq, sql, user } from "@voidhash/db";
import { Context, DateTime, Effect, Exit, Layer, Redacted } from "effect";
import * as HttpHeaders from "effect/unstable/http/Headers";
import { describe, expect, it } from "vitest";

import { makeSelfhostAuthLayers } from "../src/backend/Backend.ts";
import { getSelfhostDatabaseConfig } from "../src/config.ts";

const secret = "integration-test-standalone-secret";
const rootEmail = "standalone-auth-root@integration.test";

/**
 * Builds the auth layers directly rather than through `getSelfhostAuthConfig`,
 * so the suite does not depend on the ambient root credentials of the machine
 * running it.
 */
const authLayers = makeSelfhostAuthLayers({
  rootEmail,
  rootPassword: Redacted.make("integration-test-root-password"),
  rootUsername: "root",
  secret: Redacted.make(secret),
});

const database = Db.layer(getSelfhostDatabaseConfig());

const cleanup = Effect.gen(function* () {
  const db = yield* Db;
  yield* db.execute(
    sql`DELETE FROM "user" WHERE email = ${rootEmail} OR workos_user_id = ${STANDALONE_ROOT_SUBJECT}`,
  );
}).pipe(Effect.provide(database), Effect.scoped);

const resolve = (headers: Record<string, string>) =>
  Effect.gen(function* () {
    const verifierContext = yield* Layer.build(authLayers.authTokenVerifier);
    const verifier = Context.get(verifierContext, AuthTokenVerifier);
    return yield* resolveUserSession(HttpHeaders.fromInput(headers), verifier).pipe(
      Effect.provide(authLayers.identity.pipe(Layer.provide(database))),
      Effect.provide(LocalUserSessionService.layer),
      Effect.provide(database),
    );
  }).pipe(Effect.scoped);

const optionalName = (name?: string): { readonly name?: string } => {
  if (!name) return {};
  return { name };
};

const token = (email: string, name?: string) =>
  signStandaloneAuthToken({ email, secret, ...optionalName(name) });

/** Runs a test body and always drops the rows the suite provisions. */
const runTest = <A, E>(body: Effect.Effect<A, E>) =>
  Effect.runPromise(body.pipe(Effect.ensuring(cleanup.pipe(Effect.orDie))));

describe("standalone identity provider against Postgres", () => {
  it("creates the root user row on first cookie authentication", () =>
    runTest(
      Effect.gen(function* () {
        yield* cleanup;
        const session = yield* resolve({
          cookie: `${STANDALONE_AUTH_COOKIE_NAME}=${yield* token(rootEmail, "Root Operator")}`,
        });

        expect(session.method).toBe("user");
        expect(session.user?.email).toBe(rootEmail);
        expect(session.user?.workosUserId).toBe(STANDALONE_ROOT_SUBJECT);
        expect(session.user?.name).toBe("Root Operator");
      }),
    ));

  it("resolves the same single user through the bearer path", () =>
    runTest(
      Effect.gen(function* () {
        const bearer = yield* token(rootEmail, "Root Operator");

        const first = yield* resolve({ authorization: `Bearer ${bearer}` });
        const second = yield* resolve({ cookie: `${STANDALONE_AUTH_COOKIE_NAME}=${bearer}` });

        expect(first.user?.id).toBe(second.user?.id);
        expect(first.user?.email).toBe(rootEmail);
      }),
    ));

  it("rejects a token signed with a different secret", () =>
    runTest(
      Effect.gen(function* () {
        const forged = yield* signStandaloneAuthToken({
          email: rootEmail,
          secret: "not-the-secret",
        });

        const exit = yield* Effect.exit(resolve({ authorization: `Bearer ${forged}` }));
        expect(Exit.isFailure(exit)).toBe(true);
      }),
    ));

  it("rejects a request with no credentials", () =>
    runTest(
      Effect.gen(function* () {
        const exit = yield* Effect.exit(resolve({}));
        expect(Exit.isFailure(exit)).toBe(true);
      }),
    ));

  it("adopts an existing row for the same email instead of creating a second user", () =>
    runTest(
      Effect.gen(function* () {
        yield* cleanup;
        const now = yield* DateTime.nowAsDate;
        yield* Effect.gen(function* () {
          const db = yield* Db;
          yield* db.insert(user).values({
            banned: false,
            banExpires: null,
            banReason: null,
            createdAt: now,
            customImageUrl: null,
            email: rootEmail,
            emailVerified: true,
            id: "user_standaloneadopt00000000",
            image: null,
            name: "Previously Provisioned",
            role: null,
            updatedAt: now,
            workosUserId: "user_external_previous",
          });
        }).pipe(Effect.provide(database), Effect.scoped);

        const session = yield* resolve({ authorization: `Bearer ${yield* token(rootEmail)}` });

        expect(session.user?.id).toBe("user_standaloneadopt00000000");
        expect(session.user?.workosUserId).toBe(STANDALONE_ROOT_SUBJECT);

        const rows = yield* Effect.gen(function* () {
          const db = yield* Db;
          return yield* db.select().from(user).where(eq(user.email, rootEmail));
        }).pipe(Effect.provide(database), Effect.scoped);
        expect(rows).toHaveLength(1);
      }),
    ));
});
