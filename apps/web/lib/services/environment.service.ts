import { Context, Data, Effect } from "effect";
import { AuthSession } from "./auth.service";
import { Cookies } from "../effect/cookies";
import {
	Environment as EnvironmentEnum,
	EnvironmentValue,
} from "@voidhash/lib/constants";
import { ProjectRepository } from "../repositories/project.repository";
import { OrganizationRepository } from "../repositories/organization.repository";
import { checkProjectPermission } from "../effect/permissions";
import { HonoRuntimeTag, NextjsRuntimeTag } from "../effect/runtimes/tags";

export class MissingEnvironmentError extends Data.TaggedError(
	"MissingEnvironmentError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class InvalidEnvironmentError extends Data.TaggedError(
	"InvalidEnvironmentError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class EnvironmentCookieNotFoundError extends Data.TaggedError(
	"EnvironmentCookieNotFoundError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class ProjectNotFoundInSessionError extends Data.TaggedError(
	"ProjectNotFoundInSessionError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class OrganizationNotFoundInSessionError extends Data.TaggedError(
	"OrganizationNotFoundInSessionError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

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

type EnvironmentRetrievalOptions =
	| {
			projectId: string;
	  }
	| {
			projectSlug: string;
			organizationSlug: string;
	  }
	| {
			projectSlug: string;
			organizationId: string;
	  };

export class Environment extends Context.Tag("app/Environment")<
	Environment,
	EnvironmentValue
>() {
	public static readonly provide = (
		environment: EnvironmentValue
	): (<A, E, R>(
		self: Effect.Effect<A, E, R>
	) => Effect.Effect<A, E, Exclude<R, Environment>>) =>
		Effect.provideService(this, environment);
}

export class EnvironmentService extends Effect.Service<EnvironmentService>()(
	"app/EnvironmentService",
	{
		dependencies: [],

		effect: Effect.gen(function* () {
			return {
				getEnvironmentFromCookie: (options: EnvironmentRetrievalOptions) =>
					Effect.gen(function* () {
						yield* NextjsRuntimeTag;
						const session = yield* AuthSession;
						if (session.environment) {
							return session.environment;
						}
						// If user is authenticated with session, we can use cookies to attempt to retrieve the environment. With api-keys, the environment is already set.

						if ("projectId" in options) {
							return yield* retrieveEnvironmentFromProjectId(options.projectId);
						} else if (
							"projectSlug" in options &&
							"organizationSlug" in options
						) {
							return yield* retrieveEnvironmentFromProjectSlugAndOrganizationSlug(
								options.projectSlug,
								options.organizationSlug
							);
						} else if (
							"projectSlug" in options &&
							"organizationId" in options
						) {
							return yield* retrieveEnvironmentFromProjectSlugAndOrganizationId(
								options.projectSlug,
								options.organizationId
							);
						}

						return yield* Effect.fail(
							new MissingEnvironmentError({
								message: "Environment is not specified",
							})
						);
					}),

				getEnvironmentFromApiAuthSession: () =>
					Effect.gen(function* () {
						yield* HonoRuntimeTag;
						const session = yield* AuthSession;
						if (
							session.method !== "api-key" &&
							session.method !== "publishable-api-key"
						) {
							return yield* Effect.dieMessage(
								"Tried to get environment from api auth session, but session is not an api key"
							);
						}
						return session.environment;
					}),

				switchEnvironment: (input: {
					projectId: string;
					environment: EnvironmentValue;
				}) =>
					Effect.gen(function* () {
						yield* NextjsRuntimeTag;
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
			};
		}),
	}
) {}

const setEnvironmentCookie = (
	organizationSlug: string,
	projectSlug: string,
	environment: EnvironmentValue
) =>
	Effect.gen(function* () {
		const cookies = yield* Cookies;
		yield* cookies.setCookie(
			`project_environment_${organizationSlug}:${projectSlug}`,
			environment.toString()
		);
	});

const getEnvironmentFromCookie = (
	organizationSlug: string,
	projectSlug: string
) =>
	Effect.gen(function* () {
		const cookies = yield* Cookies;
		const projectEnvironmentCookie = yield* cookies.getCookie(
			`project_environment_${organizationSlug}:${projectSlug}`
		);
		if (!projectEnvironmentCookie) {
			return yield* Effect.fail(
				new EnvironmentCookieNotFoundError({
					message: "Environment cookie not found",
				})
			);
		}
		return yield* validateEnvironment(
			Number.parseInt(projectEnvironmentCookie)
		);
	});

const retrieveEnvironmentFromProjectId = (projectId: string) =>
	Effect.gen(function* () {
		const session = yield* AuthSession;
		const project = session.projects.find((p) => p.id === projectId);
		const organization = session.organizations.find(
			(o) => o.id === project?.organizationId
		);
		if (!project) {
			return yield* Effect.fail(
				new ProjectNotFoundInSessionError({
					message: "Project not found in session",
				})
			);
		}
		if (!organization) {
			return yield* Effect.fail(
				new OrganizationNotFoundInSessionError({
					message: "Organization not found in session",
				})
			);
		}
		return yield* getEnvironmentFromCookie(organization.slug, project.slug);
	});

const retrieveEnvironmentFromProjectSlugAndOrganizationSlug = (
	projectSlug: string,
	organizationSlug: string
) =>
	Effect.gen(function* () {
		const session = yield* AuthSession;
		const projects = session.projects.filter((p) => p.slug === projectSlug);
		const projectOrgIds = projects.map((p) => p.organizationId);
		const organizations = session.organizations.filter(
			(o) => o.slug === organizationSlug && projectOrgIds.includes(o.id)
		);

		const organization = organizations[0];
		if (!organization) {
			return yield* Effect.fail(
				new OrganizationNotFoundInSessionError({
					message: "Organization not found in session",
				})
			);
		}

		const project = projects.find((p) => p.organizationId === organization.id);
		if (!project) {
			return yield* Effect.fail(
				new ProjectNotFoundInSessionError({
					message: "Project not found in session",
				})
			);
		}
		return yield* getEnvironmentFromCookie(organization.slug, project.slug);
	});

const retrieveEnvironmentFromProjectSlugAndOrganizationId = (
	projectSlug: string,
	organizationId: string
) =>
	Effect.gen(function* () {
		const session = yield* AuthSession;
		const project = session.projects.find(
			(p) => p.slug === projectSlug && p.organizationId === organizationId
		);
		if (!project) {
			return yield* Effect.fail(
				new ProjectNotFoundInSessionError({
					message: "Project not found in session",
				})
			);
		}
		const organization = session.organizations.find(
			(o) => o.id === organizationId
		);
		if (!organization) {
			return yield* Effect.fail(
				new OrganizationNotFoundInSessionError({
					message: "Organization not found in session",
				})
			);
		}
		return yield* getEnvironmentFromCookie(organization.slug, project.slug);
	});

const validateEnvironment = (environment: number) =>
	Effect.gen(function* () {
		if (
			environment !== EnvironmentEnum.Production &&
			environment !== EnvironmentEnum.Testing
		) {
			return yield* Effect.fail(
				new InvalidEnvironmentError({
					message: `Invalid environment: ${environment}`,
				})
			);
		}
		return environment satisfies EnvironmentValue;
	});
