"use server";

import { auth } from "@voidhash/auth";
import { authActionClient } from "../../../lib/safe-action";
import { updateOrganizationSchema } from "../schema";
import { headers } from "next/headers";
import { revalidateTag } from "next/cache";
import { getOrganizationById } from "../cached-queries";

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
