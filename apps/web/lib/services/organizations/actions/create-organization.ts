import { auth } from "@voidhash/auth";
import {
	createSlug,
	createShortId,
	SLUG_BLACKLIST,
	VoidhashUnauthorizedError,
	VoidhashInternalServerError,
	fromUnknownThrow,
	VoidhashNotFoundError,
} from "@voidhash/lib";
import { z } from "zod";
import { createServiceFunction } from "@/lib/service-function";
import { createVoidhashCustomerTask } from "jobs/create-voidhash-customer-task";
import { err, ok, Result, ResultAsync } from "neverthrow";
import { isAuthenticated } from "@/lib/middlewares";

export const createOrganizationInputSchema = z.object({
	name: z.string().min(1).max(32),
});

type CreateOrganizationError =
	| VoidhashUnauthorizedError
	| VoidhashInternalServerError
	| VoidhashNotFoundError;

export const createOrganization = createServiceFunction()
	.input(createOrganizationInputSchema)
	.use(isAuthenticated)
	.function(
		async ({
			input,
			ctx,
		}): Promise<
			Result<
				{
					id: string;
					name: string;
					slug: string;
				},
				CreateOrganizationError
			>
		> => {
			let slug = createSlug(input.name);
			if (SLUG_BLACKLIST.includes(slug)) {
				slug = slug + "-" + createShortId();
			}
			try {
				await auth.api.checkOrganizationSlug({
					headers: ctx.headers,
					body: {
						slug,
					},
				});
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} catch (error: any) {
				if (error.body?.code === "SLUG_IS_TAKEN") {
					slug = slug + "-" + createShortId();
				} else {
					return err(fromUnknownThrow(error));
				}
			}

			const organization = await ResultAsync.fromPromise(
				auth.api.createOrganization({
					headers: ctx.headers,
					body: {
						name: input.name,
						slug,
					},
				}),
				(e) => fromUnknownThrow(e)
			);

			if (organization.isErr()) {
				return err(organization.error);
			}

			if (!organization.value) {
				return err({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create organization",
					originalError: new Error("Failed to create organization"),
				});
			}
			const email = ctx.session?.user?.email;
			if (!email) {
				// Should not happen
				return err({
					code: "NOT_FOUND",
					message: "User not found",
					resource: "user",
					payload: {
						email,
					},
				} satisfies VoidhashNotFoundError);
			}

			const res = await ResultAsync.fromPromise(
				createVoidhashCustomerTask.trigger({
					organizationId: organization.value.id,
					name: organization.value.name,
					email: email,
				}),
				(e) => fromUnknownThrow(e)
			);

			if (res.isErr()) {
				return err(res.error);
			}

			ctx.cache.invalidate(`organization_slug:${slug}`);
			ctx.cache.invalidate(`organization_${organization.value.id}`);

			return ok(organization.value);
		}
	);
