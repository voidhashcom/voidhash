"use server";

import { auth } from "@voidhash/auth";
import { createSlug, createShortId, SLUG_BLACKLIST } from "@voidhash/lib";
import { authActionClient } from "../../../features/lib/safe-action";
import { headers } from "next/headers";
import { z } from "zod";
import { revalidateTag } from "next/cache";

const createOrganizationSchema = z.object({
	name: z.string().min(1).max(32),
});

export const createOrganization = authActionClient
	.schema(createOrganizationSchema)
	.action(async ({ parsedInput }) => {
		let slug = createSlug(parsedInput.name);
		const reqHeaders = await headers();
		if (SLUG_BLACKLIST.includes(slug)) {
			slug = slug + "-" + createShortId();
		}
		try {
			await auth.api.checkOrganizationSlug({
				headers: reqHeaders,
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
			headers: reqHeaders,
			body: {
				name: parsedInput.name,
				slug,
			},
		});

		if (!organization) {
			return null;
		}

		revalidateTag(`organization_slug:${slug}`);
		revalidateTag(`organization_${organization.id}`);

		return organization;
	});
