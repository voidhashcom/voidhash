import { Data, Effect } from "effect";
import { ProjectRepository } from "../repositories/project.repository";
import { AuthSession } from "@/lib/services/auth.service";
import {
	checkProjectPermission,
	checkOrganizationPermission,
} from "@/lib/effect/permissions";
import { OrganizationRepository } from "../repositories/organization.repository";
import { ApiKeyRepository } from "../repositories/api-key.repository";
import { Db, TransactionContext } from "@/lib/effect/db";
import { UnauthorizedError } from "@/lib/effect/errors";
import { generateId } from "@/lib/id/generate";
import {
	createShortId,
	createSlug,
	Environment,
	SLUG_BLACKLIST,
} from "@voidhash/lib/index";
import { createPublishableKey } from "../core/api-keys/effect/utils";
import { paymentProviderConfigurations } from "@voidhash/db";
import {
	devCheckoutPaymentProviderId,
	devCheckout,
} from "@/lib/payment-providers/dev-checkout/dev-checkout";

export class ProjectNotFound extends Data.TaggedError("ProjectNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class ProjectService extends Effect.Service<ProjectService>()(
	"ProjectService",
	{
		dependencies: [ProjectRepository.Default],
		effect: Effect.gen(function* () {
			const projectRepository = yield* ProjectRepository;
			return {
				createProject: (input: {
					name: string;
					organizationId: string;
				}) =>
					Effect.gen(function* () {
						const session = yield* AuthSession;
						const projectRepository = yield* ProjectRepository;
						const apiKeyRepository = yield* ApiKeyRepository;
						const db = yield* Db;

						// SECURITY: Authorization check
						yield* checkOrganizationPermission(
							input.organizationId,
							"organization:all",
							`User ${session?.user?.id} is not authorized to create projects for organization ${input.organizationId}`
						);

						const userId = session?.user?.id;
						if (!userId) {
							return yield* Effect.fail(
								new UnauthorizedError({
									message: "You are not authorized to create projects",
								})
							);
						}

						const id = generateId("project");
						let slug = createSlug(input.name);

						if (SLUG_BLACKLIST.includes(slug)) {
							slug = slug + "-" + createShortId();
						}

						const existingProject = yield* projectRepository.getProjectBySlug({
							projectSlug: slug,
							organizationId: input.organizationId,
						});

						if (existingProject) {
							slug = slug + "-" + createShortId();
						}

						yield* db.transaction((tx) =>
							TransactionContext.provide(tx)(
								Effect.gen(function* () {
									yield* projectRepository.createProject({
										id,
										name: input.name,
										slug,
										organizationId: input.organizationId,
										createdByUserId: userId,
									});

									// Create production publishable key
									const productionPublishableKey = yield* createPublishableKey(
										Environment.Production
									);
									yield* apiKeyRepository.createApiKey({
										id: generateId("apiPublishableKey"),
										projectId: id,
										name: "Publishable key",
										...productionPublishableKey,
									});

									// Create testing publishable key
									const testingPublishableKey = yield* createPublishableKey(
										Environment.Testing
									);
									yield* apiKeyRepository.createApiKey({
										id: generateId("apiPublishableKeyTesting"),
										projectId: id,
										name: "Publishable key",
										...testingPublishableKey,
									});

									// Create dev checkout payment provider configuration using db directly since no repository exists
									const devCheckoutConfigurationId = generateId(
										"paymentProviderConfiguration"
									);
									yield* tx(async (dbTx) => {
										await dbTx.insert(paymentProviderConfigurations).values({
											id: devCheckoutConfigurationId,
											projectId: id,
											name: "Dev Checkout",
											providerId: devCheckoutPaymentProviderId,
											paymentProviderKey: devCheckout.createGlobalKey({
												paymentProviderConfigurationId:
													devCheckoutConfigurationId,
											}),
											enabled: true,
											configuration: {},
										});
									});
								})
							)
						);

						yield* Effect.log(
							`Created project ${id} for organization ${input.organizationId}`
						);

						return yield* Effect.succeed({
							id,
							slug,
						});
					}),

				getProjects: (organizationId: string) =>
					Effect.gen(function* () {
						const session = yield* AuthSession;

						// SECURITY: Authorization check
						yield* checkOrganizationPermission(
							organizationId,
							"organization:all",
							`User ${session?.user?.id} is not authorized to access projects for organization ${organizationId}`
						);

						return yield* projectRepository.getProjects(organizationId);
					}),

				getProjectById: (id: string) =>
					Effect.gen(function* () {
						const session = yield* AuthSession;
						const project = yield* projectRepository.getProjectById(id);
						if (!project) return null;

						// SECURITY: Authorization check
						yield* checkProjectPermission(
							id,
							"project:all",
							`User ${session?.user?.id} is not authorized to access project ${id}`
						);

						return project;
					}),

				getProjectBySlug: ({
					organizationId,
					slug,
				}: {
					organizationId: string;
					slug: string;
				}) =>
					Effect.gen(function* () {
						const session = yield* AuthSession;

						const project = yield* projectRepository.getProjectBySlug({
							projectSlug: slug,
							organizationId,
						});

						if (!project) return null;

						// SECURITY: Authorization check for project
						yield* checkProjectPermission(
							project.id,
							"project:all",
							`User ${session?.user?.id} is not authorized to access project ${project.id}`
						);

						return project;
					}),

				getProjectBySlugAndOrganizationSlug: ({
					organizationSlug,
					projectSlug,
				}: {
					organizationSlug: string;
					projectSlug: string;
				}) =>
					Effect.gen(function* () {
						const session = yield* AuthSession;
						const organizationRepository = yield* OrganizationRepository;
						const organization =
							yield* organizationRepository.getOrganizationBySlug(
								organizationSlug
							);
						if (!organization) return null;

						const project = yield* projectRepository.getProjectBySlug({
							projectSlug,
							organizationId: organization.id,
						});

						if (!project) return null;

						// SECURITY: Authorization check for project
						yield* checkProjectPermission(
							project.id,
							"project:all",
							`User ${session?.user?.id} is not authorized to access project ${project.id}`
						);

						return project;
					}),

				getProjectsByOrganizationSlug: (organizationSlug: string) =>
					Effect.gen(function* () {
						const session = yield* AuthSession;
						const organizationRepository = yield* OrganizationRepository;
						const organization =
							yield* organizationRepository.getOrganizationBySlug(
								organizationSlug
							);
						if (!organization) return null;

						// SECURITY: Authorization check for organization
						yield* checkOrganizationPermission(
							organization.id,
							"organization:all",
							`User ${session?.user?.id} is not authorized to access organization ${organization.id}`
						);

						return yield* projectRepository.getProjects(organization.id);
					}),

				updateProject: (input: {
					id: string;
					name: string;
				}) =>
					Effect.gen(function* () {
						const session = yield* AuthSession;
						const projectRepository = yield* ProjectRepository;

						// First check if project exists
						const project = yield* projectRepository.getProjectById(input.id);
						if (!project) {
							return yield* Effect.fail(
								new ProjectNotFound({
									message: `Project ${input.id} not found`,
								})
							);
						}

						// SECURITY: Authorization check
						yield* checkProjectPermission(
							input.id,
							"project:all",
							`User ${session?.user?.id} is not authorized to update project ${input.id}`
						);

						// Update the project
						yield* projectRepository.updateProject({
							id: input.id,
							name: input.name,
						});

						yield* Effect.log(`Updated project ${input.id}`);

						return yield* Effect.succeed(undefined);
					}),

				deleteProject: (input: {
					id: string;
				}) =>
					Effect.gen(function* () {
						const session = yield* AuthSession;
						const projectRepository = yield* ProjectRepository;

						// First check if project exists
						const project = yield* projectRepository.getProjectById(input.id);
						if (!project) {
							return yield* Effect.fail(
								new ProjectNotFound({
									message: `Project ${input.id} not found`,
								})
							);
						}

						// SECURITY: Authorization check
						yield* checkProjectPermission(
							input.id,
							"project:all",
							`User ${session?.user?.id} is not authorized to delete project ${input.id}`
						);

						// Delete the project
						yield* projectRepository.deleteProject(input.id);

						yield* Effect.log(`Deleted project ${input.id}`);

						return yield* Effect.succeed(undefined);
					}),
			};
		}),
	}
) {}
