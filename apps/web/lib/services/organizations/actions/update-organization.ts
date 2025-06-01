import { auth } from "@voidhash/auth";
import { headers } from "next/headers";
import { z } from "zod";
import {
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
import { isAuthenticated } from "@/lib/middlewares";

export const updateOrganizationInputSchema = z.object({
	organizationId: z.string(),
	name: z.string().min(1).max(32),
});

type UpdateOrganizationError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError;

export const updateOrganization = createServiceFunction()
	.input(updateOrganizationInputSchema)
	.use(isAuthenticated)
	.function(
		async ({ input, ctx }): Promise<Result<void, UpdateOrganizationError>> => {
			if (
				!hasOrganizationPermission(
					ctx,
					input.organizationId,
					"organization:all"
				)
			) {
				return err({
					code: "FORBIDDEN",
					message: "You are not authorized to update this organization",
				});
			}

			const organization = await getOrganizationByIdQuery(
				ctx,
				input.organizationId
			);

			if (organization.isErr()) {
				return err(organization.error);
			}

			try {
				await auth.api.updateOrganization({
					headers: await headers(),
					body: {
						organizationId: input.organizationId,
						data: {
							name: input.name,
						},
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
