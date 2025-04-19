import { auth } from "@voidhash/auth";
import { headers } from "next/headers";
import { z } from "zod";
import { getOrganizationById } from "./queries";
import {
	authenticateContext,
	createServiceFunction,
	hasOrganizationPermission,
} from "@/lib/service-function";
import { UnauthorizedError } from "@voidhash/lib/constants";

export const deleteOrganizationInputSchema = z.object({
	organizationId: z.string(),
});

export const deleteOrganization = createServiceFunction()
	.input(deleteOrganizationInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);

		if (
			!hasOrganizationPermission(authenticatedContext, input.organizationId, "")
		) {
			throw new UnauthorizedError(
				"You are not authorized to delete this organization"
			);
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
