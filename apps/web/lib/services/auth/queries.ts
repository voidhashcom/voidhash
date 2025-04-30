import { hashKey } from "@/lib/services/api-keys/utils";
import { ServiceContext } from "@/lib/service-function";
import { auth } from "@voidhash/auth";
import { apiKeys, projects } from "@voidhash/db";
import { VoidhashError } from "@voidhash/lib";
import { eq, inArray } from "drizzle-orm";

export async function getUserAuthSession(ctx: ServiceContext) {
	const userSession = await auth.api.getSession({
		headers: ctx.headers,
	});

	if (!userSession?.user) {
		throw new VoidhashError({
			code: "UNAUTHORIZED",
			message: "You are not authenticated",
		});
	}

	const usersOrganizations = await auth.api.listOrganizations({
		headers: ctx.headers,
	});

	const usersProjects = await ctx.db
		.select()
		.from(projects)
		.where(
			inArray(
				projects.organizationId,
				usersOrganizations.map((o) => o.id)
			)
		);

	const session = {
		method: "user",
		user: userSession.user,
		organizations: usersOrganizations.map((o) => ({
			id: o.id,
			slug: o.slug,
			permissions: [], // TODO: Add permissions
		})),
		projects: usersProjects.map((p) => ({
			id: p.id,
			slug: p.slug,
			permissions: [], // TODO: Add permissions
		})),
	} as const;

	return session;
}

export async function getSecretApiKeyAuthSession(ctx: ServiceContext) {
	const apiKey = ctx.headers.get("x-secret-key");
	if (!apiKey) {
		throw new VoidhashError({
			code: "UNAUTHORIZED",
			message: "No Secret Key provided.",
		});
	}

	const keyHash = await hashKey(apiKey);
	const apiKeyRecord = await ctx.db.query.apiKeys.findFirst({
		where: eq(apiKeys.key, keyHash),
		with: {
			project: true,
		},
	});

	if (!apiKeyRecord) {
		throw new VoidhashError({
			code: "UNAUTHORIZED",
			message: "Invalid Secret Key.",
		});
	}

	const projects = [apiKeyRecord.project];

	return {
		method: "api-key",
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		organizations: [] as any[],
		projects: projects.map((p) => ({
			id: p.id,
			slug: p.slug,
			permissions: [], // TODO: Add permissions
		})),
	} as const;
}
