import { createTRPCRouter, protectedProcedure } from "../trpc";
import { createShortId, createSlug } from "@voidhash/lib";
import { auth } from "@voidhash/auth";
import {
	createOrganizationSchema,
	deleteOrganizationSchema,
	updateOrganizationSchema,
} from "./schema";

export const organizationsRouter = createTRPCRouter({
	create: protectedProcedure
		.input(createOrganizationSchema)
		.mutation(async ({ ctx, input }) => {
			let slug = createSlug(input.name);
			try {
				await auth.api.checkOrganizationSlug({
					headers: ctx.headers,
					body: {
						slug,
					},
				});
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
			return organization;
		}),

	update: protectedProcedure
		.input(updateOrganizationSchema)
		.mutation(async ({ ctx, input }) => {
			const response = await auth.api.updateOrganization({
				headers: ctx.headers,
				body: {
					organizationId: input.organizationId,
					data: {
						name: input.name,
					},
				},
			});

			return response;
		}),

	delete: protectedProcedure
		.input(deleteOrganizationSchema)
		.mutation(async ({ ctx, input }) => {
			const response = await auth.api.deleteOrganization({
				headers: ctx.headers,
				body: {
					organizationId: input.organizationId,
				},
			});

			return response;
		}),
});
