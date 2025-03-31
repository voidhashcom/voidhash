import { queryOptions } from "@tanstack/react-query";
import { getTeamsProjectsBySlugQuery } from "../server/queries";

export const projectsQueryKeys = {
	all: ["projects"] as const,
	getTeamsProjectsBySlug: (organizationSlug: string) =>
		[...projectsQueryKeys.all, organizationSlug] as const,
};

export const teamProjectsBySlugQueryOptions = (organizationSlug: string) =>
	queryOptions({
		queryKey: projectsQueryKeys.getTeamsProjectsBySlug(organizationSlug),
		queryFn: ({ signal }) =>
			organizationSlug === ""
				? []
				: getTeamsProjectsBySlugQuery({
						data: {
							organizationSlug: organizationSlug,
						},
						signal,
					}),
	});
