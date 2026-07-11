import { Cause, Effect, Layer, Option, Schema, Context } from "effect";
import { AuthenticationError, AuthSession } from "../../domain/auth/Auth.ts";
import {
  avatarKeyFromUrl,
  avatarSha256Hex,
  deriveAvatarKey,
  isOwnedAvatarUrl,
  validateAndDecodeAvatar,
} from "../../domain/avatar.ts";
import { Db, eq, user } from "@voidhash/db";
import type { User } from "../../domain/user/User.ts";
import { InternalFeatureFlagService } from "../internalFeatureFlags/InternalFeatureFlagService.ts";
import { PublicFileStore } from "../storage/PublicFileStore.ts";

export class UserServiceError extends Schema.TaggedErrorClass<UserServiceError>("UserServiceError")(
  "UserServiceError",
  { cause: Schema.String },
) {}

export class UserService extends Context.Service<UserService>()("UserService", {
  make: Effect.gen(function* () {
    const getUser = Effect.fn("getUser")(function* () {
      const maybeSession = yield* Effect.serviceOption(AuthSession);
      if (Option.isNone(maybeSession) || !maybeSession.value.user) {
        return yield* Effect.fail(
          new AuthenticationError({
            cause: "User not found",
            message: "User not found",
          }),
        );
      }
      const session = maybeSession.value;
      yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
      yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
      if (session.user.workosUserId)
        yield* Effect.annotateCurrentSpan("voidhash.user.workos_id", session.user.workosUserId);
      yield* Effect.annotateCurrentSpan(
        "voidhash.organization.count",
        session.organizations.length,
      );
      yield* Effect.annotateCurrentSpan("voidhash.project.count", session.projects.length);
      const activeOrganization = session.organizations[0];
      if (activeOrganization) {
        yield* Effect.annotateCurrentSpan("voidhash.organization.id", activeOrganization.id);
        if (activeOrganization.workosOrganizationId)
          yield* Effect.annotateCurrentSpan(
            "voidhash.organization.workos_id",
            activeOrganization.workosOrganizationId,
          );
      }
      const activeProject = session.projects[0];
      if (activeProject) yield* Effect.annotateCurrentSpan("voidhash.project.id", activeProject.id);

      // Resolve enabled internal feature flags per org so the studio frontend
      // can ride this bootstrap. Lazily resolved (optional) and best-effort: a
      // resolution failure must never break CurrentUser, so orgs simply fall
      // back to no extra flags.
      const maybeInternalFlags = yield* Effect.serviceOption(InternalFeatureFlagService);
      const enabledFlagsByOrg = Option.isSome(maybeInternalFlags)
        ? yield* maybeInternalFlags.value
            .resolveEnabledForOrganizations(session.organizations.map((o) => o.id))
            .pipe(
              Effect.catch((error) =>
                Effect.logWarning("Failed to resolve internal feature flags for CurrentUser", {
                  cause: error.message,
                }).pipe(Effect.as({} as Record<string, readonly string[]>)),
              ),
            )
        : ({} as Record<string, readonly string[]>);

      return {
        ...session.user,
        organizations: session.organizations.map((o) => ({
          id: o.id,
          logo: o.logo,
          name: o.name,
          slug: o.slug,
          workosOrganizationId: o.workosOrganizationId,
          internalFeatureFlags: enabledFlagsByOrg[o.id] ?? [],
        })),
        projects: session.projects.map((p) => ({
          id: p.id,
          logo: p.logo,
          name: p.name,
          organizationId: p.organizationId,
          slug: p.slug,
        })),
      } satisfies typeof User.Type;
    });

    /**
     * Resolves the authenticated user id, failing for non-user (api-key)
     * sessions which have no user to attach an avatar to.
     */
    const requireUserId = Effect.fn("requireUserId")(function* () {
      const session = yield* AuthSession;
      if (!session.user) {
        return yield* Effect.fail(
          new AuthenticationError({
            cause: "An authenticated user session is required to manage your avatar.",
            message: "An authenticated user session is required to manage your avatar.",
          }),
        );
      }
      return session.user.id;
    });

    /**
     * Best-effort cleanup of a superseded avatar object (only our own keys).
     * Resolves {@link PublicFileStore} lazily so the service layer itself stays
     * dependency-free (keeping `getUser` unit-testable in isolation); the store
     * is provided by the application root wherever the avatar methods run.
     */
    const deleteSupersededAvatar = (previous: string | null, exceptKey?: string) =>
      Effect.gen(function* () {
        const publicFileStore = yield* PublicFileStore;
        if (previous === null || !isOwnedAvatarUrl(previous, publicFileStore.publicBaseUrl)) {
          return;
        }
        const oldKey = avatarKeyFromUrl(previous, publicFileStore.publicBaseUrl);
        if (oldKey === null || oldKey === exceptKey) {
          return;
        }
        yield* publicFileStore
          .deleteObject(oldKey)
          .pipe(
            Effect.catchCause((cause) =>
              Effect.logWarning(
                `Failed to delete superseded avatar object ${oldKey}: ${Cause.pretty(cause)}`,
              ),
            ),
          );
      });

    const setAvatar = Effect.fn("setUserAvatar")(
      function* (input: { readonly imageBase64: string; readonly contentType: string }) {
        const db = yield* Db;
        const publicFileStore = yield* PublicFileStore;
        const userId = yield* requireUserId();
        yield* Effect.annotateCurrentSpan("voidhash.user.id", userId);

        const { bytes, ext } = yield* validateAndDecodeAvatar(input);
        const sha256 = yield* avatarSha256Hex(bytes);
        const key = deriveAvatarKey("user", userId, sha256, ext);

        yield* publicFileStore.putObject({ key, body: bytes, contentType: input.contentType });
        const imageUrl = publicFileStore.publicUrl(key);

        const current = yield* db.query.user.findFirst({ where: { id: userId } });
        yield* db.update(user).set({ customImageUrl: imageUrl }).where(eq(user.id, userId));
        yield* deleteSupersededAvatar(current?.customImageUrl ?? null, key);

        return { imageUrl };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new UserServiceError({ cause: String(error.cause) })),
            PublicFileStoreError: (error) =>
              Effect.fail(new UserServiceError({ cause: error.cause })),
          }),
        ),
    );

    const removeAvatar = Effect.fn("removeUserAvatar")(
      function* () {
        const db = yield* Db;
        const userId = yield* requireUserId();
        yield* Effect.annotateCurrentSpan("voidhash.user.id", userId);

        const current = yield* db.query.user.findFirst({ where: { id: userId } });
        yield* db.update(user).set({ customImageUrl: null }).where(eq(user.id, userId));
        yield* deleteSupersededAvatar(current?.customImageUrl ?? null);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new UserServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    return { getUser, removeAvatar, setAvatar } as const;
  }),
}) {
  static layer = Layer.effect(UserService)(UserService.make);
}
