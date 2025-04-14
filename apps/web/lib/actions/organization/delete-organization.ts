"use server";

import { auth } from "@voidhash/auth";
import { authActionClient } from "../../../features/lib/safe-action";
import { headers } from "next/headers";
import { getOrganizationById } from "@/lib/queries/cached-queries";
import { revalidateTag } from "next/cache";
import { z } from "zod";

const deleteOrganizationSchema = z.object({
	organizationId: z.string(),
});

export const deleteOrganization = authActionClient
	.schema(deleteOrganizationSchema)
	.action(async ({ parsedInput }) => {
		const organization = await getOrganizationById(parsedInput.organizationId);
		if (!organization) {
			throw new Error("Organization not found");
		}

		const response = await auth.api.deleteOrganization({
			headers: await headers(),
			body: {
				organizationId: parsedInput.organizationId,
			},
		});

		revalidateTag(`organization_slug:${organization.slug}`);
		revalidateTag(`organization_${organization.id}`);

		return response;
	});
