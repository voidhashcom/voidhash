"use client";

import { useQuery } from "@tanstack/react-query";
import { useActiveOrganization } from "./useActiveOrganization";
import { useTRPC } from "../../trpc/react";

export function useActiveOrganizationProjects() {
	const trpc = useTRPC();
	const { activeOrganization } = useActiveOrganization();
	return useQuery(
		trpc.projects.getTeamsProjectsBySlug.queryOptions(
			{
				organizationSlug: activeOrganization?.slug ?? "",
			},
			{
				enabled: !!activeOrganization,
			}
		)
	);
}
