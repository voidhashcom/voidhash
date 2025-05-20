import "server-only";

import { Project, projects } from "@voidhash/db";
import { and, eq } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";
import { err, ok, Result, ResultAsync } from "neverthrow";
import {
	fromUnknownThrow,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
} from "@voidhash/lib/constants";

export const getProjectBySlugQuery = async (
	ctx: ServiceContext,
	organizationId,
	projectSlug: string
): Promise<
	Result<Project, VoidhashInternalServerError | VoidhashNotFoundError>
> => {
	const findProject = ResultAsync.fromThrowable(
		ctx.db.query.projects.findFirst,
		(e) => fromUnknownThrow(e)
	);
	const res = await findProject({
		where: and(
			eq(projects.slug, projectSlug),
			eq(projects.organizationId, organizationId)
		),
	});
	if (res.isErr()) {
		return err(res.error);
	}

	if (!res.value) {
		return err({
			code: "NOT_FOUND",
			message: "Project not found",
			resource: "project",
			payload: {
				organizationId,
				projectSlug,
			},
		});
	}

	return ok(res.value);
};

export const getProjectByIdQuery = async (
	ctx: ServiceContext,
	id: string
): Promise<
	Result<Project, VoidhashInternalServerError | VoidhashNotFoundError>
> => {
	const findProject = ResultAsync.fromThrowable(
		ctx.db.query.projects.findFirst,
		(e) => fromUnknownThrow(e)
	);
	const res = await findProject({
		where: eq(projects.id, id),
	});
	if (res.isErr()) {
		return err(res.error);
	}

	if (!res.value) {
		return err({
			code: "NOT_FOUND",
			message: "Project not found",
			resource: "project",
			payload: {
				id,
			},
		});
	}

	return ok(res.value);
};

export const getProjectsByIdQuery = async (
	ctx: ServiceContext,
	organizationId: string
): Promise<Result<Project[], VoidhashInternalServerError>> => {
	const findProjects = ResultAsync.fromThrowable(
		ctx.db.query.projects.findMany,
		(e) => fromUnknownThrow(e)
	);
	const res = await findProjects({
		where: eq(projects.organizationId, organizationId),
	});
	if (res.isErr()) {
		return err(res.error);
	}
	return ok(res.value);
};
