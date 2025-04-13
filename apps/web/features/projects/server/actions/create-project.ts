"use server";

import { createId, createSlug } from "@voidhash/lib";
import { authActionClient } from "../../../lib/safe-action";
import { createProjectSchema } from "../schema";
import { db, projects } from "@voidhash/db";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";

export const createProject = authActionClient
	.schema(createProjectSchema)
	.action(async ({ parsedInput, ctx }) => {
		// TODO: Add authorization

		const id = createId();
		let slug = createSlug(parsedInput.name);

		const existingProject = await db.query.projects.findFirst({
			where: and(
				eq(projects.slug, slug),
				eq(projects.organizationId, parsedInput.organizationId)
			),
		});

		if (existingProject) {
			slug = slug + "-" + randomUUID();
		}

		await db.insert(projects).values({
			id,
			name: parsedInput.name,
			slug,
			organizationId: parsedInput.organizationId,
			createdByUserId: ctx.user.id,
		});

		return {
			id,
			name: parsedInput.name,
			slug,
		};
	});
