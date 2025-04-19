import { ServiceContext } from "@/lib/service-function";
import { auth } from "@voidhash/auth";
import { db, projects } from "@voidhash/db";
import { UnauthorizedError } from "@voidhash/lib/constants";
import { inArray } from "drizzle-orm";

export async function getUserAuthSession(ctx: ServiceContext) {
	const userSession = await auth.api.getSession({
		headers: ctx.headers,
	});

	if (!userSession?.user) {
		throw new UnauthorizedError("You are not authenticated");
	}

	const usersOrganizations = await auth.api.listOrganizations({
		headers: ctx.headers,
	});

	const usersProjects = await db
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
