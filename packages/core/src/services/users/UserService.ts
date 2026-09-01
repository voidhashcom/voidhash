import { constant } from "@voidhash/lib/lang";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";
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
  make: Effect.sync(() => {
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
        yield* Effect.annotateCurrentSpan("voidhash.user.external_id", session.user.workosUserId);
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
            "voidhash.organization.external_id",
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
      const enabledFlagsByOrg = yield* Option.match(maybeInternalFlags, {
        onNone: () => Effect.succeed<Record<string, readonly string[]>>({}),
        onSome: (internalFlags) =>
          internalFlags
            .resolveEnabledForOrganizations(session.organizations.map((o) => o.id))
            .pipe(
              Effect.catch((error) =>
                Effect.logWarning("Failed to resolve internal feature flags for CurrentUser", {
                  cause: error.message,
                }).pipe(Effect.as<Record<string, readonly string[]>>({})),
              ),
            ),
      });

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
    const deleteSupersededAvatar = Effect.fn("UserService.deleteSupersededAvatar")(
      function* (
        previous: Option.Option<string>,
        exceptKey: Option.Option<string> = Option.none(),
      ) {
        const publicFileStore = yield* PublicFileStore;
        if (!isOwnedAvatarUrl(previous, publicFileStore.publicBaseUrl)) {
          return;
        }
        const oldKey = Option.flatMap(previous, (url) =>
          avatarKeyFromUrl(url, publicFileStore.publicBaseUrl),
        );
        if (
          Option.isNone(oldKey) ||
          (Option.isSome(exceptKey) && oldKey.value === exceptKey.value)
        ) {
          return;
        }
        yield* publicFileStore
          .deleteObject(oldKey.value)
          .pipe(
            Effect.catchCause((cause) =>
              Effect.logWarning(
                `Failed to delete superseded avatar object ${oldKey.value}: ${Cause.pretty(cause)}`,
              ),
            ),
          );
      },
    );

    const setAvatar = Effect.fn("setUserAvatar")(
      function* (input: { readonly imageBase64: string; readonly contentType: string }) {
        const db = yield* Db;
        const publicFileStore = yield* PublicFileStore;
        const userId = yield* requireUserId();
        yield* Effect.annotateCurrentSpan("voidhash.user.id", userId);

        const { bytes, ext } = yield* validateAndDecodeAvatar(input);
        const sha256 = yield* avatarSha256Hex(bytes);
        const key = deriveAvatarKey("user", userId, sha256, ext);

        yield* publicFileStore.putObject({
          key,
          body: bytes,
          contentType: Option.some(input.contentType),
        });
        const imageUrl = publicFileStore.publicUrl(key);

        const current = yield* db.query.user.findFirst({ where: { id: userId } });
        yield* db.update(user).set({ customImageUrl: imageUrl }).where(eq(user.id, userId));
        yield* deleteSupersededAvatar(
          Option.fromNullishOr(current?.customImageUrl),
          Option.some(key),
        );

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
        yield* deleteSupersededAvatar(Option.fromNullishOr(current?.customImageUrl));
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new UserServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    return constant({ getUser, removeAvatar, setAvatar });
  }),
}) {
  static layer = Layer.effect(UserService)(UserService.make);
}
