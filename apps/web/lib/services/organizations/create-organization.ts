import { auth } from "@voidhash/auth";
import { createSlug, createShortId, SLUG_BLACKLIST } from "@voidhash/lib";
import { z } from "zod";
import { createServiceFunction } from "@/lib/service-function";

export const createOrganizationInputSchema = z.object({
	name: z.string().min(1).max(32),
});

export const createOrganization = createServiceFunction()
	.input(createOrganizationInputSchema)
	.function(async ({ input, ctx }) => {
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

		ctx.cache.invalidate(`organization_slug:${slug}`);
		ctx.cache.invalidate(`organization_${organization.id}`);

		return organization;
	});
