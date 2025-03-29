import { z } from "zod";

export const createOrganizationSchema = z.object({
	name: z.string().min(1).max(32),
});

export const updateOrganizationSchema = z.object({
	organizationId: z.string(),
	name: z.string().min(1).max(32),
});
