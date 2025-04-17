import { auth } from "@voidhash/auth";
import { headers } from "next/headers";
import { z } from "zod";
import { getOrganizationById } from "./queries";
import { createServiceFunction } from "@/lib/service-function";

export const deleteOrganizationInputSchema = z.object({
	organizationId: z.string(),
});

export const deleteOrganization = createServiceFunction()
	.input(deleteOrganizationInputSchema)
	.function(async ({ input, ctx }) => {
		const organization = await getOrganizationById({
			ctx,
			input: {
				id: input.organizationId,
			},
		});
		if (!organization) {
			throw new Error("Organization not found");
		}

		const response = await auth.api.deleteOrganization({
			headers: await headers(),
			body: {
				organizationId: input.organizationId,
			},
		});

		ctx.cache.invalidate(`organization_slug:${organization.slug}`);
		ctx.cache.invalidate(`organization_${organization.id}`);

		return response;
	});
