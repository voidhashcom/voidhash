import { z, ZodError } from "zod";
import { CacheAdapter } from "./cache-adapter";
import { CookiesAdapter } from "./cookies-adapter";
import {
	getPublishableApiKeyAuthSession,
	getSecretApiKeyAuthSession,
	getUserAuthSession,
	VoidhashAuthSession,
} from "./services/auth/queries";
import {
	fromUnknownThrow,
	type AnyVoidhashError,
	type VoidhashBadRequestError,
	type VoidhashInternalServerError,
	type VoidhashUnauthorizedError,
} from "@voidhash/lib/constants";
import { Database, Transaction } from "@voidhash/db";
import { Logger } from "./logger/types";
import { OrganizationPermission } from "./services/organizations/permissions";
import { ProjectPermission } from "./services/projects/permissions";
import { err, ok, Result } from "neverthrow";

export type ServiceParamWithInput<T = unknown> = {
	ctx: ServiceContext;
	input: T;
};

export type ServiceParamWithoutInput = {
	ctx: ServiceContext;
};

export function createServiceFunction() {
	return {
		input: <TSchema extends z.ZodType>(schema: TSchema) => {
			type Input = z.infer<TSchema>;

			return {
				function: <
					OutputType = unknown,
					ErrorType extends AnyVoidhashError = AnyVoidhashError,
				>(
					fn: ({
						input,
						ctx,
					}: { input: Input; ctx: ServiceContext }) => Promise<
						Result<OutputType, ErrorType>
					>
				) => {
					const invokableFunction = {
						invoke: async ({
							ctx,
							input,
						}: ServiceParamWithInput<Input>): Promise<
							Result<
								OutputType,
								| ErrorType
								| VoidhashBadRequestError
								| VoidhashInternalServerError
							>
						> => {
							try {
								const validatedInput = schema.parse(input) as Input;
								const result = await fn({ ctx, input: validatedInput });
								if (result.isErr()) {
									if (result.error.code === "INTERNAL_SERVER_ERROR") {
										console.log(result.error);
									}
									if (result.error.code === "FORBIDDEN") {
										console.log(result.error);
									}
									return err(result.error);
								}
								return ok(result.value);
							} catch (e) {
								if (e instanceof ZodError) {
									return err({
										code: "BAD_REQUEST",
										message: "Invalid input",
										validationErrors: e,
									} satisfies VoidhashBadRequestError);
								}
								return err(fromUnknownThrow(e));
							}
						},
					};
					return invokableFunction;
				},
			};
		},
		function: <
			OutputType = unknown,
			ErrorType extends AnyVoidhashError = AnyVoidhashError,
		>(
			fn: ({
				ctx,
			}: { ctx: ServiceContext }) => Promise<Result<OutputType, ErrorType>>
		) => {
			const invokableFunction = {
				invoke: async ({ ctx }: ServiceParamWithoutInput) => {
					return await fn({ ctx });
				},
			};
			return invokableFunction;
		},
	};
}

export type ServiceContext = {
	headers: Headers;
	cache: CacheAdapter;
	cookies: CookiesAdapter;
	source: "nextjs" | "api-server" | "api-sdk";
	session?: VoidhashAuthSession | null;
	db: Database;
	tx?: Transaction;
	logger: Logger;
};

type AuthenticateContextError =
	| VoidhashUnauthorizedError
	| VoidhashInternalServerError;

export async function authenticateContext(
	ctx: ServiceContext
): Promise<Result<ServiceContext, AuthenticateContextError>> {
	// Do this only once
	if (ctx.session) {
		return ok(ctx);
	}
	if (ctx.source === "nextjs") {
		const session = await getUserAuthSession(ctx);
		if (session.isErr()) {
			return err(session.error);
		}

		if (!session.value) {
			return err({
				code: "UNAUTHORIZED",
				message: "User is not authenticated",
			});
		}

		return ok({
			...ctx,
			session: session.value,
		});
	}

	if (ctx.source === "api-server") {
		const apiKey = ctx.headers.get("x-secret-key");
		if (!apiKey) {
			return err({
				code: "UNAUTHORIZED",
				message: "Secret key is required. Add it to the x-secret-key header.",
			});
		}

		const session = await getSecretApiKeyAuthSession(ctx);
		if (session.isErr()) {
			return err(session.error);
		}

		return ok({
			...ctx,
			session: session.value,
		});
	}

	if (ctx.source === "api-sdk") {
		const publishableApiKey = ctx.headers.get("x-publishable-key");
		if (!publishableApiKey) {
			return err({
				code: "UNAUTHORIZED",
				message:
					"Publishable key is required. Add it to the x-publishable-key header.",
			});
		}

		const session = await getPublishableApiKeyAuthSession(ctx);
		if (session.isErr()) {
			return err(session.error);
		}

		return ok({
			...ctx,
			session: session.value,
		});
	}

	return err({
		code: "UNAUTHORIZED",
		message: "No session found",
	});
}

export function hasProjectPermission(
	ctx: ServiceContext,
	projectId: string,
	permission: ProjectPermission
) {
	return ctx.session?.projects.some(
		(p) => p.id === projectId && p.permissions.includes(permission)
	);
}

export function hasOrganizationPermission(
	ctx: ServiceContext,
	organizationId: string,
	permission: OrganizationPermission
) {
	return ctx.session?.organizations.some(
		(o) => o.id === organizationId && o.permissions.includes(permission)
	);
}
