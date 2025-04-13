"use server";

import { auth } from "@voidhash/auth";
import { authActionClient } from "../../../lib/safe-action";
import { deleteOrganizationSchema } from "../schema";
import { headers } from "next/headers";
import { getOrganizationById } from "../cached-queries";
import { revalidateTag } from "next/cache";

export const deleteOrganization = authActionClient
	.schema(deleteOrganizationSchema)
	.action(async ({ parsedInput }) => {
		const organization = await getOrganizationById(parsedInput.organizationId);
		if (!organization) {
			throw new Error("Organization not found");
		}

		// TODO: Add authorization
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
