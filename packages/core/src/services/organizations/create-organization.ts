import { BetterAuth } from '@voidhash/auth/effect';
import { createShortId, createSlug } from '@voidhash/lib';
import { SLUG_BLACKLIST } from '@voidhash/lib/constants';
import { AuthSession, OrganizationServiceError } from '@voidhash/shared';
import { Effect, Either } from 'effect';

const _checkSlugAvailable = (betterAuth: BetterAuth) => (slug: string) =>
  Effect.gen(function* () {
    const res = yield* Effect.either(
      betterAuth.use(async (client) =>
        client.api.checkOrganizationSlug({
          body: { slug }
        })
      )
    );

    if (Either.isLeft(res)) {
      const error = res.left;
      if (
        error.cause &&
        error.cause &&
        // biome-ignore lint/suspicious/noExplicitAny: is ok
        (error.cause as any).body?.code === 'SLUG_IS_TAKEN'
      ) {
        return false;
      }
      return yield* Effect.fail(res.left);
    }

    return true;
  });

export const createOrganization = Effect.gen(function* () {
  const betterAuth = yield* BetterAuth;
  return Effect.fn('createOrganization')(
    function* (input: { name: string }) {
      const session = yield* AuthSession;

      let slug = createSlug(input.name);
      if (SLUG_BLACKLIST.includes(slug)) {
        slug = `${slug}-${createShortId()}`;
      }

      const slugIsAvailable = yield* _checkSlugAvailable(betterAuth)(slug);
      if (!slugIsAvailable) {
        slug = `${slug}-${createShortId()}`;
      }

      const organization = yield* betterAuth.use(async (client) =>
        client.api.createOrganization({
          body: {
            userId: session?.user?.id,
            name: input.name,
            slug
          }
        })
      );
      if (!organization) {
        return yield* Effect.fail(
          new OrganizationServiceError({
            cause: 'Organization was not created.'
          })
        );
      }

      return {
        id: organization.id,
        name: organization.name,
        slug
      };
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          BetterAuthError: (error) =>
            new OrganizationServiceError({
              cause: String(error.cause)
            })
        })
      )
  );
});
