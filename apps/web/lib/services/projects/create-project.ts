import { createServiceFunction } from "@/lib/service-function";
import { createPublishableKey } from "@/lib/api-keys/utils";
import { Environments } from "@/lib/environments/types";
import { db, projects, apiKeys } from "@voidhash/db";
import {
	NotFoundError,
	SLUG_BLACKLIST,
	UnauthorizedError,
} from "@voidhash/lib/constants";
import { createId, createSlug, createShortId } from "@voidhash/lib/functions";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getOrganizationById } from "../organizations/queries";
import { getUser } from "../users/queries";

export const createProjectInputSchema = z.object({
	name: z.string().min(1).max(32),
	organizationId: z.string(),
});

export const createProject = createServiceFunction()
	.input(createProjectInputSchema)
	.function(async ({ input, ctx }) => {
		const user = await getUser({ ctx });
		if (!user) {
			throw new UnauthorizedError("User not found");
		}
		const organization = await getOrganizationById({
			ctx,
			input: {
				id: input.organizationId,
			},
		});
		if (!organization) {
			throw new NotFoundError("Organization not found");
		}

		const id = createId();
		let slug = createSlug(input.name);

		if (SLUG_BLACKLIST.includes(slug)) {
			slug = slug + "-" + createShortId();
		}

		const existingProject = await db.query.projects.findFirst({
			where: and(
				eq(projects.slug, slug),
				eq(projects.organizationId, input.organizationId)
			),
		});

		if (existingProject) {
			slug = slug + "-" + randomUUID();
		}

		await db.transaction(async (tx) => {
			await tx.insert(projects).values({
				id,
				name: input.name,
				slug,
				organizationId: input.organizationId,
				createdByUserId: user.id,
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

		ctx.cache.invalidate(`project_${id}`);
		ctx.cache.invalidate(`project_slug:${slug}`);
		ctx.cache.invalidate(`projects_${organization.id}`);

		return {
			id,
			name: input.name,
			slug,
		};
	});
