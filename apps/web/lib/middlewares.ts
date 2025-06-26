import { err, ok, Result } from "neverthrow";
import {
	authenticateContext,
	createMiddleware,
	ServiceContext,
} from "./service-function";
import {
	Environment,
	VoidhashInternalServerError,
} from "@voidhash/lib/constants";
import { getEnvironment } from "./services/environments/utils";

export const isAuthenticated = createMiddleware(async ({ ctx }) => {
	const authenticatedContext = await authenticateContext(ctx);
	if (authenticatedContext.isErr()) {
		return err(authenticatedContext.error);
	}
	return ok(authenticatedContext.value);
});

type ServiceContextWithEnvironment = ServiceContext & {
	session: {
		environment: Environment;
	};
};

export const hasEnvironment = createMiddleware(
	async ({
		ctx,
		input,
	}): Promise<
		Result<ServiceContextWithEnvironment, VoidhashInternalServerError>
	> => {
		const session = ctx.session;
		if (!session) {
			return err({
				code: "INTERNAL_SERVER_ERROR",
				message: "Session is not specified",
				originalError: new Error("Session is not specified"),
			} satisfies VoidhashInternalServerError);
		}

		if (session.environment) {
			return ok(ctx as ServiceContextWithEnvironment);
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const anyInput = input as any;
		const projectId =
			anyInput.projectId && typeof anyInput.projectId === "string"
				? anyInput.projectId
				: undefined;
		const projectSlug =
			anyInput.projectSlug && typeof anyInput.projectSlug === "string"
				? anyInput.projectSlug
				: undefined;
		const organizationId =
			anyInput.organizationId && typeof anyInput.organizationId === "string"
				? anyInput.organizationId
				: undefined;
		const organizationSlug =
			anyInput.organizationSlug && typeof anyInput.organizationSlug === "string"
				? anyInput.organizationSlug
				: undefined;

		if (ctx.session?.method === "user") {
			if (projectId) {
				const project = ctx.session.projects.find((p) => p.id === projectId);
				const organization = ctx.session.organizations.find(
					(o) => o.id === project?.organizationId
				);
				if (project && organization) {
					const environment = await getEnvironment(
						ctx.cookies,
						organization.slug,
						project.slug
					);
					if (environment.isOk()) {
						return ok(setSessionEnvironment(ctx, environment.value));
					}
				}
			}

			if (projectSlug && organizationSlug) {
				// Slugs are not unique, so we need to find the project and organization that match the slugs
				const projects = ctx.session.projects.filter(
					(p) => p.slug === projectSlug
				);
				const projectOrgIds = projects.map((p) => p.organizationId);
				const organizations = ctx.session.organizations.filter(
					(o) => o.slug === organizationSlug && projectOrgIds.includes(o.id)
				);

				const organization = organizations[0];
				if (organization) {
					const project = projects.find(
						(p) => p.organizationId === organization.id
					);
					if (project) {
						const environment = await getEnvironment(
							ctx.cookies,
							organization.slug,
							project.slug
						);
						if (environment.isOk()) {
							return ok(setSessionEnvironment(ctx, environment.value));
						}
					}
				}
			}

			if (projectSlug && organizationId) {
				const project = ctx.session.projects.find(
					(p) => p.slug === projectSlug && p.organizationId === organizationId
				);
				const organization = ctx.session.organizations.find(
					(o) => o.id === organizationId
				);
				if (project && organization) {
					const environment = await getEnvironment(
						ctx.cookies,
						organization.slug,
						project.slug
					);
					if (environment.isOk()) {
						return ok(setSessionEnvironment(ctx, environment.value));
					}
				}
			}
		}

		return err({
			code: "INTERNAL_SERVER_ERROR",
			message: "Environment is not specified",
			originalError: new Error("Environment is not specified"),
		} satisfies VoidhashInternalServerError);
	}
);

const setSessionEnvironment = <T extends ServiceContext>(
	ctx: T,
	environment: Environment
): ServiceContextWithEnvironment => {
	return {
		...ctx,
		session: {
			...ctx.session, // Assuming ctx.session is non-null when this is called, as implied by prior logic and original types.
			environment,
		} as NonNullable<T["session"]> & { environment: Environment },
	}; // Assert the return type to be ServiceContext
};
