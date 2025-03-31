import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../../lib/middlewares/auth-middleware";
import { getTeamsProjectsBySlugSchema } from "./schema";
import { getTeamsProjectsBySlug } from "./actions/get-teams-projects-by-slug";

export const getTeamsProjectsBySlugQuery = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator((input) => getTeamsProjectsBySlugSchema.parse(input))
	.handler(async ({ data, context }) => {
		const { organizationSlug } = data;
		const projects = await getTeamsProjectsBySlug({
			organizationSlug,
		});
		return projects;
	});
