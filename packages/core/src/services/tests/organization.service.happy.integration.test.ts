import { Effect, Exit, pipe } from 'effect';
import { describe, expect, it, test } from 'vitest';
import { createIntegrationTestRunner } from '../../integration-test-runtime';
import { IntegrationHarness } from '../../testing/integration-harness';
import { AuthSession } from '../auth-service';
import { OrganizationService } from '../organization-service';

describe.sequential('OrganizationService happy path', () => {
  // TODO: Fix this test, it's failing because the better-auth cookie is not set
  // biome-ignore lint/suspicious/noSkippedTests: TODO
  it.skip('should create an organization successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const input = {
      name: 'Test Organization'
    };
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const organizationService = yield* OrganizationService;
            // TODO: Pass real headers. This probably won't work.
            const organization = yield* organizationService.createOrganization(
              input,
              new Headers()
            );
            return organization;
          }),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          )
        );
      })
    );

    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });
    expect(Exit.isSuccess(result)).toBe(true);
    expect(value).toMatchObject({
      name: 'Test Organization'
    });
    expect(value.id).toBeDefined();
    expect(value.slug).toBeDefined();

    // Note: Organization cleanup is handled by the auth system, not directly in tests
  });

  test('should get organization by slug', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const organizationService = yield* OrganizationService;
            const organization =
              yield* organizationService.getOrganizationBySlug(
                // biome-ignore lint/style/noNonNullAssertion: allways true, ok in test
                h.resources.organization.slug!
              );
            return organization;
          }),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          )
        );
      })
    );

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });

    expect(value).toMatchObject({
      id: h.resources.organization.id,
      name: h.resources.organization.name,
      slug: h.resources.organization.slug
    });
  });

  test('should get organization by ID', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const organizationService = yield* OrganizationService;
            const organization = yield* organizationService.getOrganizationById(
              h.resources.organization.id
            );
            return organization;
          }),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          )
        );
      })
    );

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });

    expect(value).toMatchObject({
      id: h.resources.organization.id,
      name: h.resources.organization.name,
      slug: h.resources.organization.slug
    });
  });

  // TODO: Fix this test, it's failing because the better-auth cookie is not set
  // biome-ignore lint/suspicious/noSkippedTests: TODO
  it.skip('should update organization successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const input = {
      organizationId: h.resources.organization.id,
      name: 'Updated Organization Name'
    };
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const organizationService = yield* OrganizationService;
            // TODO: Pass real headers. This probably won't work.
            yield* organizationService.updateOrganization(input, new Headers());
            return 'updated';
          }),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          )
        );
      })
    );

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });

    expect(value).toBe('updated');
  });

  // TODO: Fix this test, it's failing because the better-auth cookie is not set
  // biome-ignore lint/suspicious/noSkippedTests: TODO
  it.skip('should delete organization successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const input = {
      organizationId: h.resources.organization.id
    };
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const organizationService = yield* OrganizationService;
            // TODO: Pass real headers. This probably won't work.
            yield* organizationService.deleteOrganization(input, new Headers());
            return 'deleted';
          }),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          )
        );
      })
    );

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });

    expect(value).toBe('deleted');
  });
});
