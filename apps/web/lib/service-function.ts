import { z } from "zod";
import { CacheAdapter } from "./cache-adapter";
import { CookiesAdapter } from "./cookies-adapter";
import { User } from "better-auth";
import {
	getSecretApiKeyAuthSession,
	getUserAuthSession,
} from "./services/auth/queries";
import { VoidhashError } from "@voidhash/lib/constants";
import { Database, Transaction } from "@voidhash/db";
import { Logger } from "./logger/types";

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
				function: <OutputType = unknown>(
					fn: ({
						input,
						ctx,
					}: { input: Input; ctx: ServiceContext }) => Promise<OutputType>
				) => {
					const invokableFunction = {
						invoke: async ({
							ctx,
							input,
						}: ServiceParamWithInput<Input>): Promise<OutputType> => {
							const validatedInput = schema.parse(input) as Input;
							return await fn({ ctx, input: validatedInput });
						},
					};
					return invokableFunction;
				},
			};
		},
		function: <OutputType = unknown>(
			fn: ({ ctx }: { ctx: ServiceContext }) => Promise<OutputType>
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

type UserSession = AuthSession & {
	method: "user";
};

type ApiKeySession = AuthSession & {
	method: "api-key";
};

type AuthSession = {
	organizations: {
		id: string;
		slug: string;
		permissions: string[];
	}[];
	projects: {
		id: string;
		slug: string;
		permissions: string[];
	}[];
	user?: User;
};

export type ServiceContext = {
	headers: Headers;
	cache: CacheAdapter;
	cookies: CookiesAdapter;
	source: "nextjs" | "api-server" | "api-sdk";
	session?: UserSession | ApiKeySession | null;
	db: Database;
	tx?: Transaction;
	logger: Logger;
};

export async function authenticateContext(
	ctx: ServiceContext
): Promise<ServiceContext> {
	// Do this only once
	if (ctx.session) {
		return ctx;
	}
	if (ctx.source === "nextjs") {
		const session = await getUserAuthSession(ctx);
		if (!session) {
			throw new VoidhashError({
				code: "UNAUTHORIZED",
				message: "User is not authenticated",
			});
		}
		return {
			...ctx,
			session,
		};
	}

	if (ctx.source === "api-server") {
		const apiKey = ctx.headers.get("x-secret-key");
		if (!apiKey) {
			throw new VoidhashError({
				code: "UNAUTHORIZED",
				message: "Secret key is required. Add it to the x-secret-key header.",
			});
		}

		const session = await getSecretApiKeyAuthSession(ctx);
		return {
			...ctx,
			session,
		};
	}

	return ctx;
}

export function hasProjectPermission(
	ctx: ServiceContext,
	projectId: string,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	permission: string
) {
	return ctx.session?.projects.some(
		(p) =>
			p.id ===
			projectId /* && p.permissions.includes(permission) TODO: Add permissions */
	);
}

export function hasOrganizationPermission(
	ctx: ServiceContext,
	organizationId: string,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	permission: string
) {
	return ctx.session?.organizations.some(
		(o) =>
			o.id ===
			organizationId /* && o.permissions.includes(permission) TODO: Add permissions */
	);
}
