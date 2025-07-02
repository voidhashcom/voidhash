import { Context, Data, Effect } from "effect";
import { AuthSession } from "./auth";
import { Cookies } from "./cookies";
import { Environment as EnvironmentType } from "@voidhash/lib/constants";

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

const withEnvironment =
	(options?: EnvironmentRetrievalOptions) =>
	<T, E, D>(effect: Effect.Effect<T, E, D>) =>
		Effect.gen(function* () {
			const environment = yield* getEnvironment(options).pipe(
				Effect.catchTags({
					ProjectNotFoundInSessionError: () =>
						Effect.fail(
							new MissingEnvironmentError({
								message: "Project not found in session",
							})
						).pipe(Effect.tapError((e) => Effect.log(e.message))),
					OrganizationNotFoundInSessionError: () =>
						Effect.fail(
							new MissingEnvironmentError({
								message: "Organization not found in session",
							})
						).pipe(Effect.tapError((e) => Effect.log(e.message))),
					EnvironmentCookieNotFoundError: () =>
						Effect.fail(
							new MissingEnvironmentError({
								message: "Environment cookie not found",
							})
						).pipe(Effect.tapError((e) => Effect.log(e.message))),
					InvalidEnvironmentError: () =>
						Effect.fail(
							new MissingEnvironmentError({
								message: "Invalid environment",
							})
						).pipe(Effect.tapError((e) => Effect.logWarning(e.message))),
				})
			);
			return yield* Effect.provideService(effect, Environment, environment);
		});

export class Environment extends Context.Tag("app/Environment")<
	Environment,
	EnvironmentType
>() {
	static withEnvironment = withEnvironment;
}

const getEnvironment = (options?: EnvironmentRetrievalOptions) =>
	Effect.gen(function* () {
		const session = yield* AuthSession;
		if (session.environment) {
			return session.environment;
		}
		// If user is authenticated with session, we can use cookies to attempt to retrieve the environment. With api-keys, the environment is already set.
		if (options && session.method === "user") {
			if ("projectId" in options) {
				return yield* retrieveEnvironmentFromProjectId(options.projectId);
			} else if ("projectSlug" in options && "organizationSlug" in options) {
				return yield* retrieveEnvironmentFromProjectSlugAndOrganizationSlug(
					options.projectSlug,
					options.organizationSlug
				);
			} else if ("projectSlug" in options && "organizationId" in options) {
				return yield* retrieveEnvironmentFromProjectSlugAndOrganizationId(
					options.projectSlug,
					options.organizationId
				);
			}
		}
		return yield* Effect.fail(
			new MissingEnvironmentError({
				message: "Environment is not specified",
			})
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

export const getEnvironmentFromCookie = (
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
		return yield* validateEnvironment(projectEnvironmentCookie);
	});

export const setEnvironmentCookie = (
	organizationSlug: string,
	projectSlug: string,
	environment: EnvironmentType
) =>
	Effect.gen(function* () {
		const cookies = yield* Cookies;
		yield* cookies.setCookie(
			`project_environment_${organizationSlug}:${projectSlug}`,
			environment
		);
	});

const validateEnvironment = (environment: string) =>
	Effect.gen(function* () {
		if (environment !== "production" && environment !== "testing") {
			return yield* Effect.fail(
				new InvalidEnvironmentError({
					message: `Invalid environment: ${environment}`,
				})
			);
		}
		return environment satisfies EnvironmentType;
	});
