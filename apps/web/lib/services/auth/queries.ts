import { hashKey } from "@/lib/services/api-keys/utils";
import { ServiceContext } from "@/lib/service-function";
import { auth } from "@voidhash/auth";
import { apiKeys, projects } from "@voidhash/db";
import {
	fromUnknownThrow,
	VoidhashInternalServerError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { eq, inArray } from "drizzle-orm";
import { err, ok, Result, ResultAsync } from "neverthrow";
import {
	ApiKeySession,
	PublishableApiKeySession,
	UserSession,
} from "@/lib/service-function-auth";

export async function getUserAuthSession(
	ctx: ServiceContext
): Promise<
	Result<UserSession, VoidhashInternalServerError | VoidhashUnauthorizedError>
> {
	const userSession = await ResultAsync.fromPromise(
		auth.api.getSession({
			headers: ctx.headers,
		}),
		(e) => fromUnknownThrow(e)
	);

	if (userSession.isErr()) {
		return err(userSession.error);
	}

	if (!userSession.value?.user) {
		return err({
			code: "UNAUTHORIZED",
			message: "You are not authenticated",
		});
	}

	const usersOrganizations = await ResultAsync.fromPromise(
		auth.api.listOrganizations({
			headers: ctx.headers,
		}),
		(e) => fromUnknownThrow(e)
	);

	if (usersOrganizations.isErr()) {
		return err(usersOrganizations.error);
	}

	const usersProjects = await ResultAsync.fromPromise(
		ctx.db
			.select()
			.from(projects)
			.where(
				inArray(
					projects.organizationId,
					usersOrganizations.value.map((o) => o.id)
				)
			),
		(e) => fromUnknownThrow(e)
	);

	if (usersProjects.isErr()) {
		return err(usersProjects.error);
	}

	return ok({
		method: "user",
		user: {
			...userSession.value.user,
			image: userSession.value.user.image || null,
		},
		customer: null,
		organizations: usersOrganizations.value.map((o) => ({
			id: o.id,
			slug: o.slug,
			permissions: ["organization:all"], // TODO: Add permissions
		})),
		projects: usersProjects.value.map((p) => ({
			id: p.id,
			slug: p.slug,
			permissions: ["project:all"], // TODO: Add permissions
		})),
	});
}

type GetSecretApiKeyAuthSessionError =
	| VoidhashUnauthorizedError
	| VoidhashInternalServerError;

export async function getSecretApiKeyAuthSession(
	ctx: ServiceContext
): Promise<Result<ApiKeySession, GetSecretApiKeyAuthSessionError>> {
	const apiKey = ctx.headers.get("x-secret-key");
	if (!apiKey) {
		return err({
			code: "UNAUTHORIZED",
			message: "No Secret Key provided.",
		});
	}

	const keyHash = await hashKey(apiKey);
	const apiKeyRecord = await ResultAsync.fromPromise(
		ctx.db.query.apiKeys.findFirst({
			where: eq(apiKeys.key, keyHash),
			with: {
				project: true,
			},
		}),
		(e) => fromUnknownThrow(e)
	);

	if (apiKeyRecord.isErr()) {
		return err(apiKeyRecord.error);
	}

	if (!apiKeyRecord.value) {
		return err({
			code: "UNAUTHORIZED",
			message: "Invalid Secret Key.",
		});
	}

	const projects = [apiKeyRecord.value.project];

	return ok({
		method: "api-key",
		customer: null,
		user: null,
		organizations: [],
		projects: projects.map((p) => ({
			id: p.id,
			slug: p.slug,
			permissions: ["project:all"], // TODO: Add permissions
		})),
	} as const);
}

type GetPublishableApiKeyAuthSessionError =
	| VoidhashUnauthorizedError
	| VoidhashInternalServerError;

export const getPublishableApiKeyAuthSession = async (
	ctx: ServiceContext
): Promise<
	Result<PublishableApiKeySession, GetPublishableApiKeyAuthSessionError>
> => {
	const publishableApiKey = ctx.headers.get("x-publishable-key");
	if (!publishableApiKey) {
		return err({
			code: "UNAUTHORIZED",
			message:
				"Publishable key is required. Add it to the x-publishable-key header.",
		});
	}

	const apiKeyRecord = await ResultAsync.fromPromise(
		ctx.db.query.apiKeys.findFirst({
			where: eq(apiKeys.key, publishableApiKey),
			with: {
				project: true,
			},
		}),
		(e) => fromUnknownThrow(e)
	);

	if (apiKeyRecord.isErr()) {
		return err(apiKeyRecord.error);
	}
	if (!apiKeyRecord.value) {
		return err({
			code: "UNAUTHORIZED",
			message: "Invalid Publishable Key.",
		});
	}

	const appUserId = ctx.headers.get("x-app-user-id");

	if (!appUserId) {
		return err({
			code: "UNAUTHORIZED",
			message: "App User ID not found.",
		});
	}

	const sdkOrigin = ctx.headers.get("x-sdk-origin");
	const sdkVersion = ctx.headers.get("x-sdk-version");
	const os = ctx.headers.get("x-os");
	const device = ctx.headers.get("x-device");

	const projects = [apiKeyRecord.value.project];

	return ok({
		method: "publishable-api-key",
		user: null,
		customer: {
			appUserId: appUserId,
			sdkOrigin,
			sdkVersion,
			os,
			device,
		},
		organizations: [] as never[],
		projects: projects.map((p) => ({
			id: p.id,
			slug: p.slug,
			permissions: [],
		})),
	} as const);
};
