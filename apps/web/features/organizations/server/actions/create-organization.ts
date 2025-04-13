"use server";

import { auth } from "@voidhash/auth";
import { createSlug, createShortId } from "@voidhash/lib";
import { authActionClient } from "../../../lib/safe-action";
import { createOrganizationSchema } from "../schema";
import { headers } from "next/headers";

export const createOrganization = authActionClient
	.schema(createOrganizationSchema)
	.action(async ({ parsedInput }) => {
		// TODO: Add authorization
		let slug = createSlug(parsedInput.name);
		const reqHeaders = await headers();
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

		return organization;
	});
