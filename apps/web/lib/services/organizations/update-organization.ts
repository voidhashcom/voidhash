import { auth } from "@voidhash/auth";
import { headers } from "next/headers";
import { z } from "zod";
import { getOrganizationById } from "./queries";
import {
	authenticateContext,
	createServiceFunction,
	hasOrganizationPermission,
} from "@/lib/service-function";
import { VoidhashError } from "@voidhash/lib/constants";

export const updateOrganizationInputSchema = z.object({
	organizationId: z.string(),
	name: z.string().min(1).max(32),
});

export const updateOrganization = createServiceFunction()
	.input(updateOrganizationInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);

		if (
			!hasOrganizationPermission(authenticatedContext, input.organizationId, "")
		) {
			throw new VoidhashError({
				code: "FORBIDDEN",
				message: "You are not authorized to update this organization",
			});
		}

		const organization = await getOrganizationById({
			ctx: authenticatedContext,
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
