import { resolveUserSession } from "@voidhash/backend/AuthSessionResolver";
import { AuthTokenVerifier } from "@voidhash/core/services/auth/AuthTokenVerifier";
import { LocalUserSessionService } from "@voidhash/core/services/auth/LocalUserSessionService";
import {
  STANDALONE_AUTH_COOKIE_NAME,
  STANDALONE_ROOT_SUBJECT,
  signStandaloneAuthToken,
} from "@voidhash/core/utils/crypto/standalone-auth-token";
import { Db, eq, sql, user } from "@voidhash/db";
import { Context, Effect, Layer, Redacted } from "effect";
import * as HttpHeaders from "effect/unstable/http/Headers";
import { afterAll, describe, expect, it } from "vitest";

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
  }).pipe(Effect.scoped, Effect.runPromise);

const token = (email: string, name?: string) =>
  Effect.runPromise(signStandaloneAuthToken({ email, secret, ...(name ? { name } : {}) }));

describe("standalone identity provider against Postgres", () => {
  afterAll(async () => {
    await Effect.runPromise(cleanup);
  });

  it("creates the root user row on first cookie authentication", async () => {
    await Effect.runPromise(cleanup);
    const session = await resolve({
      cookie: `${STANDALONE_AUTH_COOKIE_NAME}=${await token(rootEmail, "Root Operator")}`,
    });

    expect(session.method).toBe("user");
    expect(session.user?.email).toBe(rootEmail);
    expect(session.user?.workosUserId).toBe(STANDALONE_ROOT_SUBJECT);
    expect(session.user?.name).toBe("Root Operator");
  });

  it("resolves the same single user through the bearer path", async () => {
    const bearer = await token(rootEmail, "Root Operator");

    const first = await resolve({ authorization: `Bearer ${bearer}` });
    const second = await resolve({ cookie: `${STANDALONE_AUTH_COOKIE_NAME}=${bearer}` });

    expect(first.user?.id).toBe(second.user?.id);
    expect(first.user?.email).toBe(rootEmail);
  });

  it("rejects a token signed with a different secret", async () => {
    const forged = await Effect.runPromise(
      signStandaloneAuthToken({ email: rootEmail, secret: "not-the-secret" }),
    );

    await expect(resolve({ authorization: `Bearer ${forged}` })).rejects.toBeDefined();
  });

  it("rejects a request with no credentials", async () => {
    await expect(resolve({})).rejects.toBeDefined();
  });

  it("adopts an existing row for the same email instead of creating a second user", async () => {
    await Effect.runPromise(cleanup);
    await Effect.runPromise(
      Effect.gen(function* () {
        const db = yield* Db;
        yield* db.insert(user).values({
          banned: false,
          banExpires: null,
          banReason: null,
          createdAt: new Date(),
          customImageUrl: null,
          email: rootEmail,
          emailVerified: true,
          id: "user_standaloneadopt00000000",
          image: null,
          name: "Previously Provisioned",
          role: null,
          updatedAt: new Date(),
          workosUserId: "user_external_previous",
        });
      }).pipe(Effect.provide(database), Effect.scoped),
    );

    const session = await resolve({ authorization: `Bearer ${await token(rootEmail)}` });

    expect(session.user?.id).toBe("user_standaloneadopt00000000");
    expect(session.user?.workosUserId).toBe(STANDALONE_ROOT_SUBJECT);

    const rows = await Effect.runPromise(
      Effect.gen(function* () {
        const db = yield* Db;
        return yield* db.select().from(user).where(eq(user.email, rootEmail));
      }).pipe(Effect.provide(database), Effect.scoped),
    );
    expect(rows).toHaveLength(1);
  });
});
