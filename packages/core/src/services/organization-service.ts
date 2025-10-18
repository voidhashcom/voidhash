import { BetterAuth } from '@voidhash/auth/effect';
import { eq, organization } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { createShortId, createSlug } from '@voidhash/lib';
import { SLUG_BLACKLIST } from '@voidhash/lib/constants';
import {
  AuthSession,
  OrganizationNotFoundError,
  OrganizationServiceError
} from '@voidhash/shared';
import { Effect, Either, pipe } from 'effect';

import { checkOrganizationPermission } from '../utils/permissions';

export class OrganizationService extends Effect.Service<OrganizationService>()(
  'OrganizationService',
  {
    // Specify dependencies
    dependencies: [BetterAuth.Default],
    effect: Effect.gen(function* () {
      const betterAuth = yield* BetterAuth;
      const dbService = yield* Db;

      const _checkSlugAvailable = (slug: string) =>
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

      const createOrganization = (input: { name: string }) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;

            let slug = createSlug(input.name);
            if (SLUG_BLACKLIST.includes(slug)) {
              slug = `${slug}-${createShortId()}`;
            }

            const slugIsAvailable = yield* _checkSlugAvailable(slug);
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
          }),
          Effect.catchTags({
            BetterAuthError: (error) =>
              new OrganizationServiceError({
                cause: String(error.cause)
              })
          })
        );

      const _getOrganizationBySlug = dbService.makeQuery(
        (execute, slug: string) =>
          execute(
            async (db) =>
              await db.query.organization.findFirst({
                where: eq(organization.slug, slug)
              })
          )
      );
      const getOrganizationBySlug = (slug: string) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;

            const organization = yield* _getOrganizationBySlug(slug);
            if (!organization) {
              return yield* Effect.fail(
                new OrganizationNotFoundError({
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
          Effect.catchTags({
            DatabaseError: (error) =>
              new OrganizationServiceError({
                cause: String(error.cause)
              })
          })
        );

      const _getOrganizationById = dbService.makeQuery((execute, id: string) =>
        execute(
          async (db) =>
            await db.query.organization.findFirst({
              where: eq(organization.id, id)
            })
        )
      );

      const getOrganizationById = (id: string) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;

            const organization = yield* _getOrganizationById(id);
            if (!organization) {
              return yield* Effect.fail(
                new OrganizationNotFoundError({
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
          Effect.catchTags({
            DatabaseError: (error) =>
              new OrganizationServiceError({
                cause: String(error.cause)
              })
          })
        );

      const deleteOrganization = (
        input: { organizationId: string },
        cookie: string
      ) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;

            // SECURITY: Authorization check
            yield* checkOrganizationPermission(
              input.organizationId,
              'organization:all',
              `User ${session?.user?.id} is not authorized to delete organization ${input.organizationId}`
            );

            yield* betterAuth.use(async (client) =>
              client.api.deleteOrganization({
                headers: new Headers({
                  cookie
                }),
                body: { organizationId: input.organizationId }
              })
            );

            return yield* Effect.succeed(undefined);
          }),
          Effect.catchTags({
            BetterAuthError: (error) =>
              new OrganizationServiceError({
                cause: String(error.cause)
              })
          })
        );

      const updateOrganization = (
        input: { organizationId: string; name: string },
        cookie: string
      ) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const organization = yield* _getOrganizationById(
              input.organizationId
            );
            if (!organization) {
              return yield* Effect.fail(
                new OrganizationNotFoundError({
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

            yield* betterAuth.use(async (client) =>
              client.api.updateOrganization({
                headers: new Headers({
                  cookie
                }),
                body: {
                  organizationId: input.organizationId,
                  data: {
                    name: input.name
                  }
                }
              })
            );

            return yield* Effect.succeed(undefined);
          }),
          Effect.catchTags({
            DatabaseError: (error) =>
              new OrganizationServiceError({
                cause: String(error.cause)
              }),
            BetterAuthError: (error) =>
              new OrganizationServiceError({
                cause: String(error.cause)
              })
          })
        );

      return {
        createOrganization,
        getOrganizationBySlug,
        getOrganizationById,
        deleteOrganization,
        updateOrganization
      } as const;
    })
  }
) {}
