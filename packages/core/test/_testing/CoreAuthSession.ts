import {
  type AnyAuthSession,
  AuthSession,
  type UserSession,
} from "@voidhash/core/domain/auth/Auth";
import { Effect } from "effect";

import { CoreTestFixture } from "./CoreTestFixture";

/**
 * Default authenticated session for tests: a `user`-method session for the
 * seeded {@link CoreTestFixture} principal, holding `organization:all` /
 * `project:all` so `checkProjectPermission(fixture.projectId, "project:all")`
 * passes. Override fields (e.g. narrower permissions) by passing a custom
 * session to {@link CoreAuthSession.authenticate}.
 */
const defaultUserSession = (): UserSession => ({
  cookie: null,
  method: "user",
  name: `${CoreTestFixture.userName} <${CoreTestFixture.userEmail}>`,
  organizations: [
    {
      id: CoreTestFixture.organizationId,
      logo: null,
      name: CoreTestFixture.organizationName,
      permissions: ["organization:all"],
      slug: CoreTestFixture.organizationSlug,
      workosOrganizationId: CoreTestFixture.workosOrganizationId,
    },
  ],
  person: null,
  projects: [
    {
      id: CoreTestFixture.projectId,
      logo: null,
      name: CoreTestFixture.projectName,
      organizationId: CoreTestFixture.organizationId,
      permissions: ["project:all"],
      slug: CoreTestFixture.projectSlug,
    },
  ],
  user: {
    createdAt: new Date(0),
    email: CoreTestFixture.userEmail,
    emailVerified: true,
    id: CoreTestFixture.userId,
    image: null,
    name: CoreTestFixture.userName,
    role: null,
    updatedAt: new Date(0),
    workosUserId: CoreTestFixture.workosUserId,
  },
});

export const CoreAuthSession = {
  /**
   * Pipeable that provides {@link AuthSession} to a test effect. Call with no
   * arguments for the default full-permission fixture user, or pass a custom
   * session to exercise other auth methods / permission sets:
   *
   * ```ts
   * effect.pipe(CoreAuthSession.authenticate())
   * effect.pipe(CoreAuthSession.authenticate(mySecretKeySession))
   * ```
   */
  authenticate:
    (session: AnyAuthSession = defaultUserSession()) =>
    <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      effect.pipe(Effect.provideService(AuthSession, session)),
};
