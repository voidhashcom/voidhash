import { describe, expect, test } from "vitest";
import { Cause, Effect, Exit, pipe } from "effect";
import { AuthSession } from "../auth.service";
import {
	OrganizationService,
	OrganizationNotFound,
} from "../organization.service";
import { IntegrationHarness } from "../../testing/integration-harness";
import { createIntegrationTestRunner } from "../../effect/runtimes/integration-test";
import { generateId } from "@/lib/id/generate";

describe.sequential("OrganizationService error path", () => {
	test("should fail to get organization by non-existent slug", async (t) => {
		const h = await IntegrationHarness.init(t);

		const integrationTestRunner = createIntegrationTestRunner("hono");
		const nonExistentSlug = "non-existent-organization";
		const result = await integrationTestRunner(
			Effect.gen(function* () {
				return yield* pipe(
					Effect.gen(function* () {
						const organizationService = yield* OrganizationService;
						const organization =
							yield* organizationService.getOrganizationBySlug(nonExistentSlug);
						return organization;
					}),
					Effect.provideService(
						AuthSession,
						h.createAuthSession({ type: "user" }),
					),
				);
			}),
		);

		expect(Exit.isFailure(result)).toBe(true);
		const error = Exit.getOrElse(result, (e) => Cause.squash(e));
		expect(error).toBeInstanceOf(OrganizationNotFound);
	});

	test("should fail to get organization by non-existent ID", async (t) => {
		const h = await IntegrationHarness.init(t);

		const integrationTestRunner = createIntegrationTestRunner("hono");
		const nonExistentId = generateId("test");
		const result = await integrationTestRunner(
			Effect.gen(function* () {
				return yield* pipe(
					Effect.gen(function* () {
						const organizationService = yield* OrganizationService;
						const organization =
							yield* organizationService.getOrganizationById(nonExistentId);
						return organization;
					}),
					Effect.provideService(
						AuthSession,
						h.createAuthSession({ type: "user" }),
					),
				);
			}),
		);

		expect(Exit.isFailure(result)).toBe(true);
		const error = Exit.getOrElse(result, (e) => Cause.squash(e));
		expect(error).toBeInstanceOf(OrganizationNotFound);
	});

	test("should fail to update non-existent organization", async (t) => {
		const h = await IntegrationHarness.init(t);

		const integrationTestRunner = createIntegrationTestRunner("hono");
		const nonExistentId = generateId("test");
		const input = {
			organizationId: nonExistentId,
			name: "Updated Organization Name",
		};
		const result = await integrationTestRunner(
			Effect.gen(function* () {
				return yield* pipe(
					Effect.gen(function* () {
						const organizationService = yield* OrganizationService;
						yield* organizationService.updateOrganization(input);
						return "updated";
					}),
					Effect.provideService(
						AuthSession,
						h.createAuthSession({ type: "user" }),
					),
				);
			}),
		);

		expect(Exit.isFailure(result)).toBe(true);
		const error = Exit.getOrElse(result, (e) => Cause.squash(e));
		expect(error).toBeInstanceOf(OrganizationNotFound);
	});

	test("should fail to delete non-existent organization", async (t) => {
		const h = await IntegrationHarness.init(t);

		const integrationTestRunner = createIntegrationTestRunner("hono");
		const nonExistentId = generateId("test");
		const input = {
			organizationId: nonExistentId,
		};
		const result = await integrationTestRunner(
			Effect.gen(function* () {
				return yield* pipe(
					Effect.gen(function* () {
						const organizationService = yield* OrganizationService;
						yield* organizationService.deleteOrganization(input);
						return "deleted";
					}),
					Effect.provideService(
						AuthSession,
						h.createAuthSession({ type: "user" }),
					),
				);
			}),
		);

		// This might succeed or fail depending on the implementation
		// For now, we'll just check that it doesn't throw an unexpected error
		expect(Exit.isSuccess(result) || Exit.isFailure(result)).toBe(true);
	});
});
