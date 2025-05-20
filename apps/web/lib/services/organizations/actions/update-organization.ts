import { auth } from "@voidhash/auth";
import { headers } from "next/headers";
import { z } from "zod";
import { getOrganizationById } from "../queries";
import {
	authenticateContext,
	createServiceFunction,
	hasOrganizationPermission,
} from "@/lib/service-function";
import {
	fromUnknownThrow,
	VoidhashError,
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { err, ok, Result } from "neverthrow";

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
	.function(
		async ({ input, ctx }): Promise<Result<void, UpdateOrganizationError>> => {
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
					message: "You are not authorized to update this organization",
				});
			}

			const organization = await getOrganizationById({
				ctx: authenticatedContext.value,
				input: {
					id: input.organizationId,
				},
			});

			if (organization.isErr()) {
				return err(organization.error);
			}

			if (!organization.value) {
				return err({
					code: "NOT_FOUND",
					message: "Organization not found",
					resource: "organization",
					payload: {
						organizationId: input.organizationId,
					},
				});
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
