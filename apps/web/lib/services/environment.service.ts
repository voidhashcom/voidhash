import { Data, Effect, pipe, Schema } from "effect";

import { AuthSession } from "@/lib/effect/auth";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { ProjectRepository } from "../repositories/project.repository";
import { OrganizationRepository } from "../repositories/organization.repository";
import { setEnvironmentCookie } from "@/lib/effect/environment";
import { Environment } from "@voidhash/lib/index";

export class ProjectNotFoundError extends Data.TaggedError(
	"ProjectNotFoundError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class OrganizationNotFoundError extends Data.TaggedError(
	"OrganizationNotFoundError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class OrganizationWithoutSlugError extends Data.TaggedError(
	"OrganizationWithoutSlugError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const switchEnvironmentInputSchema = Schema.Struct({
	projectId: Schema.String,
	environment: Schema.Union(
		Schema.Literal(Environment.Production),
		Schema.Literal(Environment.Testing)
	),
});

type SwitchEnvironmentInput = Schema.Schema.Type<
	typeof switchEnvironmentInputSchema
>;

export class EnvironmentService extends Effect.Service<EnvironmentService>()(
	"EnvironmentService",
	{
		effect: Effect.gen(function* () {
			return {
				switchEnvironment: (inputUnsafe: SwitchEnvironmentInput) =>
					pipe(
						Effect.gen(function* () {
							const input = Schema.decodeUnknownSync(
								switchEnvironmentInputSchema
							)(inputUnsafe);
							const session = yield* AuthSession;
							const projectRepository = yield* ProjectRepository;
							const organizationRepository = yield* OrganizationRepository;
							yield* checkProjectPermission(
								input.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to switch environment for project ${input.projectId}`
							);
							const project = yield* projectRepository.getProjectById(
								input.projectId
							);
							if (!project) {
								return yield* Effect.fail(
									new ProjectNotFoundError({
										message: `Project ${input.projectId} not found`,
									})
								);
							}
							const organization =
								yield* organizationRepository.getOrganizationById(
									project.organizationId
								);
							if (!organization) {
								return yield* Effect.fail(
									new OrganizationNotFoundError({
										message: `Organization ${project.organizationId} not found`,
									})
								);
							}
							if (!organization.slug) {
								return yield* Effect.fail(
									new OrganizationWithoutSlugError({
										message: `Organization ${project.organizationId} has no slug`,
									})
								);
							}
							yield* setEnvironmentCookie(
								organization.slug,
								project.slug,
								input.environment
							);
						}),
						AuthSession.withAuthSession()
					),
			};
		}),

		// Specify dependencies
		dependencies: [],
	}
) {}
