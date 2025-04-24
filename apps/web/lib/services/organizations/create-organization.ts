import { auth } from "@voidhash/auth";
import {
	createSlug,
	createShortId,
	SLUG_BLACKLIST,
	NotFoundError,
} from "@voidhash/lib";
import { z } from "zod";
import {
	authenticateContext,
	createServiceFunction,
} from "@/lib/service-function";
import { createVoidhashCustomerTask } from "jobs/create-voidhash-customer-task";

export const createOrganizationInputSchema = z.object({
	name: z.string().min(1).max(32),
});

export const createOrganization = createServiceFunction()
	.input(createOrganizationInputSchema)
	.function(async ({ input, ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);

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
				throw error;
			}
		}
		const organization = await auth.api.createOrganization({
			headers: ctx.headers,
			body: {
				name: input.name,
				slug,
			},
		});

		if (!organization) {
			return null;
		}

		const user = authenticatedContext.session?.user?.email;
		if (!user) {
			// Should not happen
			throw new NotFoundError("User not found");
		}

		await createVoidhashCustomerTask.trigger({
			organizationId: organization.id,
			name: organization.name,
			email: user,
		});

		ctx.cache.invalidate(`organization_slug:${slug}`);
		ctx.cache.invalidate(`organization_${organization.id}`);

		return organization;
	});
