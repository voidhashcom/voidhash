import { auth } from "@voidhash/auth";
import { headers } from "next/headers";
import { z } from "zod";
import {
	authenticateContext,
	createServiceFunction,
	hasOrganizationPermission,
} from "@/lib/service-function";
import {
	fromUnknownThrow,
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { err, ok, Result } from "neverthrow";
import { getOrganizationByIdQuery } from "../raw-queries";

export const deleteOrganizationInputSchema = z.object({
	organizationId: z.string(),
});

type DeleteOrganizationError =
	| VoidhashInternalServerError
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashNotFoundError;

export const deleteOrganization = createServiceFunction()
	.input(deleteOrganizationInputSchema)
	.function(
		async ({ input, ctx }): Promise<Result<void, DeleteOrganizationError>> => {
			const authenticatedContext = await authenticateContext(ctx);
			if (authenticatedContext.isErr()) {
				return err(authenticatedContext.error);
			}

			if (
				!hasOrganizationPermission(
					authenticatedContext.value,
					input.organizationId,
					"organization:all"
				)
			) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to delete this organization",
				});
			}

			const organization = await getOrganizationByIdQuery(
				authenticatedContext.value,
				input.organizationId
			);

			if (organization.isErr()) {
				return err(organization.error);
			}

			try {
				await auth.api.deleteOrganization({
					headers: await headers(),
					body: {
						organizationId: input.organizationId,
					},
				});
				ctx.cache.invalidate(`organization_slug:${organization.value.slug}`);
				ctx.cache.invalidate(`organization_${organization.value.id}`);
				return ok(undefined);
			} catch (error) {
				return err(fromUnknownThrow(error));
			}
		}
	);
