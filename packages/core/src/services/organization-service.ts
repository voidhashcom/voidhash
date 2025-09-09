import { BetterAuth } from '@voidhash/auth/effect';
import { createShortId, createSlug } from '@voidhash/lib';
import { SLUG_BLACKLIST } from '@voidhash/lib/constants';
import {
  FailedToCreateOrganizationError,
  OrganizationNotFound,
  UserSessionNotFoundError
} from '@voidhash/shared/errors';
import { Effect, Either } from 'effect';
import { OrganizationRepository } from '../repositories/organization-repository';
import { checkOrganizationPermission } from '../utils/permissions';
import { AuthSession } from './auth-service';

export class OrganizationService extends Effect.Service<OrganizationService>()(
  'OrganizationService',
  {
    // Specify dependencies
    dependencies: [OrganizationRepository.Default, BetterAuth.Default],
    effect: Effect.gen(function* () {
      const betterAuth = yield* BetterAuth;
      const organizationRepository = yield* OrganizationRepository;

      const checkSlugAvailable = (slug: string) =>
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
              return yield* Effect.succeed(false);
            }
            return yield* Effect.fail(res.left);
          }

          return yield* Effect.succeed(true);
        });

      return {
        createOrganization: (input: { name: string }, headers: Headers) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;

            let slug = createSlug(input.name);
            if (SLUG_BLACKLIST.includes(slug)) {
              slug = `${slug}-${createShortId()}`;
            }

            const slugIsAvailable = yield* checkSlugAvailable(slug, headers);
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
                new FailedToCreateOrganizationError({
                  message: 'Failed to create organization'
                })
              );
            }

            const email = session?.user?.email;
            if (!email) {
              return yield* Effect.fail(
                new UserSessionNotFoundError({
                  message: 'User session not found'
                })
              );
            }

            return yield* Effect.succeed({
              id: organization.id,
              name: organization.name,
              slug
            });
          }),

        getOrganizationBySlug: (slug: string) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;

            const organization =
              yield* organizationRepository.getOrganizationBySlug(slug);
            if (!organization) {
              return yield* Effect.fail(
                new OrganizationNotFound({
                  message: `Organization with slug ${slug} not found`
                })
              );
            }
            // SECURITY: Authorization check
            yield* checkOrganizationPermission(
              organization.id,
              'organization:all',
              `User ${session?.user?.id} is not authorized to access organization ${organization.id}`
            );

            return organization;
          }),

        getOrganizationById: (id: string) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const organizationRepository = yield* OrganizationRepository;

            const organization =
              yield* organizationRepository.getOrganizationById(id);
            if (!organization) {
              return yield* Effect.fail(
                new OrganizationNotFound({
                  message: `Organization with id ${id} not found`
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkOrganizationPermission(
              id,
              'organization:all',
              `User ${session?.user?.id} is not authorized to access organization ${id}`
            );

            return organization;
          }),

        deleteOrganization: (
          input: { organizationId: string },
          headers: Headers
        ) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;

            // SECURITY: Authorization check
            yield* checkOrganizationPermission(
              input.organizationId,
              'organization:all',
              `User ${session?.user?.id} is not authorized to delete organization ${input.organizationId}`
            );

            const betterAuth = yield* BetterAuth;
            yield* betterAuth.use(async (client) =>
              client.api.deleteOrganization({
                headers,
                body: { organizationId: input.organizationId }
              })
            );

            return yield* Effect.succeed(undefined);
          }),

        updateOrganization: (
          input: { organizationId: string; name: string },
          headers: Headers
        ) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;

            const organization =
              yield* organizationRepository.getOrganizationById(
                input.organizationId
              );
            if (!organization) {
              return yield* Effect.fail(
                new OrganizationNotFound({
                  message: `Organization with id ${input.organizationId} not found`
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkOrganizationPermission(
              input.organizationId,
              'organization:all',
              `User ${session?.user?.id} is not authorized to update organization ${input.organizationId}`
            );

            const betterAuth = yield* BetterAuth;
            yield* betterAuth.use(async (client) =>
              client.api.updateOrganization({
                headers,
                body: {
                  organizationId: input.organizationId,
                  data: {
                    name: input.name
                  }
                }
              })
            );

            return yield* Effect.succeed(undefined);
          })
      };
    })
  }
) {}
