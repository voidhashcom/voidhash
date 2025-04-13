"use server";

import { auth } from "@voidhash/auth";
import { authActionClient } from "../../../features/lib/safe-action";
import { headers } from "next/headers";
import { revalidateTag } from "next/cache";
import { getOrganizationById } from "@/lib/queries/cached-queries";
import { z } from "zod";

const updateOrganizationSchema = z.object({
	organizationId: z.string(),
	name: z.string().min(1).max(32),
});

export const updateOrganization = authActionClient
	.schema(updateOrganizationSchema)
	.action(async ({ parsedInput }) => {
		const organization = await getOrganizationById(parsedInput.organizationId);
		if (!organization) {
			throw new Error("Organization not found");
		}

		const response = await auth.api.updateOrganization({
			headers: await headers(),
			body: {
				organizationId: parsedInput.organizationId,
				data: {
					name: parsedInput.name,
				},
			},
		});

		revalidateTag(`organization_slug:${organization.slug}`);
		revalidateTag(`organization_${organization.id}`);

		return response;
	});
