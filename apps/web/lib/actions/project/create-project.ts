"use server";

import {
	createId,
	createShortId,
	createSlug,
	NotFoundError,
	SLUG_BLACKLIST,
} from "@voidhash/lib";
import { authActionClient } from "../../../features/lib/safe-action";
import { apiKeys, db, projects } from "@voidhash/db";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getOrganizationById } from "@/lib/queries/cached-queries";
import { revalidateTag } from "next/cache";
import { createPublishableKey } from "@/lib/api-keys/utils";
import { Environments } from "@/lib/environments/types";

const createProjectSchema = z.object({
	name: z.string().min(1).max(32),
	organizationId: z.string(),
});

export const createProject = authActionClient
	.schema(createProjectSchema)
	.action(async ({ parsedInput, ctx }) => {
		const organization = await getOrganizationById(parsedInput.organizationId);
		if (!organization) {
			throw new NotFoundError("Organization not found");
		}

		const id = createId();
		let slug = createSlug(parsedInput.name);

		if (SLUG_BLACKLIST.includes(slug)) {
			slug = slug + "-" + createShortId();
		}

		const existingProject = await db.query.projects.findFirst({
			where: and(
				eq(projects.slug, slug),
				eq(projects.organizationId, parsedInput.organizationId)
			),
		});

		if (existingProject) {
			slug = slug + "-" + randomUUID();
		}

		await db.transaction(async (tx) => {
			await tx.insert(projects).values({
				id,
				name: parsedInput.name,
				slug,
				organizationId: parsedInput.organizationId,
				createdByUserId: ctx.user.id,
			});

			// Save production publishable key
			const productionPublishableKey = await createPublishableKey(
				Environments.Production
			);
			await tx.insert(apiKeys).values({
				id: createId(),
				projectId: id,
				name: "Publishable key",
				...productionPublishableKey,
			});

			// Save testing publishable key
			const testingPublishableKey = await createPublishableKey(
				Environments.Testing
			);
			await tx.insert(apiKeys).values({
				id: createId(),
				projectId: id,
				name: "Publishable key",
				...testingPublishableKey,
			});
		});

		revalidateTag(`project_${id}`);
		revalidateTag(`project_slug:${slug}`);
		revalidateTag(`projects_${organization.id}`);

		return {
			id,
			name: parsedInput.name,
			slug,
		};
	});
