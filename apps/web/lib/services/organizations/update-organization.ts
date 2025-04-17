import { auth } from "@voidhash/auth";
import { headers } from "next/headers";
import { z } from "zod";
import { getOrganizationById } from "./queries";
import { createServiceFunction } from "@/lib/service-function";

export const updateOrganizationInputSchema = z.object({
	organizationId: z.string(),
	name: z.string().min(1).max(32),
});

export const updateOrganization = createServiceFunction()
	.input(updateOrganizationInputSchema)
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

		const response = await auth.api.updateOrganization({
			headers: await headers(),
			body: {
				organizationId: input.organizationId,
				data: {
					name: input.name,
				},
			},
		});

		ctx.cache.invalidate(`organization_slug:${organization.slug}`);
		ctx.cache.invalidate(`organization_${organization.id}`);

		return response;
	});
