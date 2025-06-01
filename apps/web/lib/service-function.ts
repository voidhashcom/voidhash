import { z, ZodError } from "zod";
import { CacheAdapter } from "./cache-adapter";
import { CookiesAdapter } from "./cookies-adapter";
import {
	getPublishableApiKeyAuthSession,
	getSecretApiKeyAuthSession,
	getUserAuthSession,
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
import { VoidhashAuthSession } from "./service-function-auth";

export type ServiceParamWithInput<T = unknown> = {
	ctx: ServiceContext;
	input: T;
};

export type ServiceParamWithoutInput = {
	ctx: ServiceContext;
};

export type Middleware<
	TServiceInput,
	CtxIn extends ServiceContext,
	CtxOut extends ServiceContext = CtxIn,
	TError extends AnyVoidhashError = AnyVoidhashError,
> = (params: { ctx: CtxIn; input: TServiceInput }) => Promise<
	Result<CtxOut, TError>
>;

export function createMiddleware<
	TServiceInput,
	CtxIn extends ServiceContext,
	CtxOut extends ServiceContext = CtxIn,
	TError extends AnyVoidhashError = AnyVoidhashError,
>(
	fn: (params: { ctx: CtxIn; input: TServiceInput }) => Promise<
		Result<CtxOut, TError>
	>
) {
	return fn;
}

// Represents the final, callable service function
class InvokableServiceFunction<
	TInput,
	TOutput,
	TFunctionError extends AnyVoidhashError, // Error from the core function itself
	TAllMiddlewareErrors extends AnyVoidhashError, // Union of all errors from all middlewares
	FinalCtx extends ServiceContext, // Context type after all middlewares
> {
	private fn: (params: { input: TInput; ctx: FinalCtx }) => Promise<
		Result<TOutput, TFunctionError>
	>;
	private schema?: z.ZodType<TInput>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private middlewares: Middleware<TInput, any, any, AnyVoidhashError>[];

	constructor(
		fn: (params: { input: TInput; ctx: FinalCtx }) => Promise<
			Result<TOutput, TFunctionError>
		>,
		schema?: z.ZodType<TInput>,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		middlewares?: Middleware<TInput, any, any, AnyVoidhashError>[]
	) {
		this.fn = fn;
		this.schema = schema;
		this.middlewares = middlewares || [];
	}

	public invoke = async (
		params: TInput extends undefined
			? ServiceParamWithoutInput
			: ServiceParamWithInput<TInput>
	): Promise<
		Result<
			TOutput,
			| TFunctionError
			| TAllMiddlewareErrors
			| VoidhashBadRequestError
			| VoidhashInternalServerError
		>
	> => {
		try {
			let currentCtx: ServiceContext = params.ctx;
			const originalInput: TInput = (params as ServiceParamWithInput<TInput>)
				.input;

			// Run middlewares
			for (const mw of this.middlewares) {
				const mwResult = await mw({
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					ctx: currentCtx as any,
					input: originalInput,
				});
				if (mwResult.isErr()) {
					// Cast is necessary because mwResult.error is AnyVoidhashError from array typing,
					// but we know it's one of the errors included in TAllMiddlewareErrors.
					return err(mwResult.error as TAllMiddlewareErrors);
				}
				currentCtx = mwResult.value; // Update context
			}

			let validatedInput: TInput = originalInput;
			if (this.schema) {
				const parseResult = this.schema.safeParse(originalInput);
				if (!parseResult.success) {
					return err({
						code: "BAD_REQUEST",
						message: "Invalid input",
						validationErrors: parseResult.error,
					} satisfies VoidhashBadRequestError);
				}
				validatedInput = parseResult.data;
			}

			const result = await this.fn({
				ctx: currentCtx as FinalCtx, // Context after middlewares
				input: validatedInput,
			});
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
	};
}

class ServiceFunctionBuilder<
	TSchema extends z.ZodType | undefined = undefined,
	CurrentCtx extends ServiceContext = ServiceContext, // Tracks context type
	TCurrentMiddlewareErrors extends AnyVoidhashError = never, // Accumulates middleware errors
> {
	private readonly schema?: TSchema;
	private readonly middlewares: Middleware<
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		any, // This 'any' is for TServiceInput of the middleware
		ServiceContext,
		ServiceContext,
		AnyVoidhashError // This is TError of the middleware in the array
	>[];

	constructor(
		schema?: TSchema,
		middlewares: Middleware<
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			any,
			ServiceContext,
			ServiceContext,
			AnyVoidhashError
		>[] = []
	) {
		this.schema = schema;
		this.middlewares = middlewares;
	}

	public input = <NewTSchema extends z.ZodType>(
		schema: NewTSchema
	): ServiceFunctionBuilder<
		NewTSchema,
		CurrentCtx,
		TCurrentMiddlewareErrors
	> => {
		return new ServiceFunctionBuilder(schema, this.middlewares);
	};

	public use = <
		MwServiceInput = TSchema extends z.ZodType ? z.infer<TSchema> : undefined,
		MwCtxOut extends ServiceContext = CurrentCtx,
		MwError extends AnyVoidhashError = AnyVoidhashError,
	>(
		middleware: Middleware<MwServiceInput, CurrentCtx, MwCtxOut, MwError>
	): ServiceFunctionBuilder<
		TSchema,
		MwCtxOut,
		TCurrentMiddlewareErrors | MwError
	> => {
		const newMiddlewares = [
			...this.middlewares,
			middleware as Middleware<
				// Cast to the array's element type
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				any,
				ServiceContext,
				ServiceContext,
				AnyVoidhashError
			>,
		];
		return new ServiceFunctionBuilder(this.schema, newMiddlewares);
	};

	public function = <
		TOutput = unknown,
		TFunctionError extends AnyVoidhashError = AnyVoidhashError, // Error from the function itself
	>(
		fn: (params: {
			input: TSchema extends z.ZodType ? z.infer<TSchema> : undefined;
			ctx: CurrentCtx; // Function receives context after all middlewares
		}) => Promise<Result<TOutput, TFunctionError>>
	): InvokableServiceFunction<
		TSchema extends z.ZodType ? z.infer<TSchema> : undefined,
		TOutput,
		TFunctionError, // Pass the function's own error type
		TCurrentMiddlewareErrors, // Pass the accumulated middleware errors
		CurrentCtx
	> => {
		type ServiceFnInput = TSchema extends z.ZodType
			? z.infer<TSchema>
			: undefined;
		return new InvokableServiceFunction(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			fn as any,
			this.schema,
			// Cast the middlewares to match the expected input type for InvokableServiceFunction's constructor
			this.middlewares as Middleware<
				ServiceFnInput,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				any,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				any,
				AnyVoidhashError
			>[]
		);
	};
}

export function createServiceFunction() {
	return new ServiceFunctionBuilder<undefined, ServiceContext, never>(); // Initial context and 'never' for middleware errors
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
