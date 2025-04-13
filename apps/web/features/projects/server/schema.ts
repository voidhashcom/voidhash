import { z } from "zod";

export const createProjectSchema = z.object({
	name: z.string().min(1).max(32),
	organizationId: z.string(),
});

export const getTeamsProjectsBySlugSchema = z.object({
	organizationSlug: z.string(),
});

export const updateProjectSchema = z.object({
	projectId: z.string(),
	name: z.string().min(1).max(32),
});

export const deleteProjectSchema = z.object({
	projectId: z.string(),
});
