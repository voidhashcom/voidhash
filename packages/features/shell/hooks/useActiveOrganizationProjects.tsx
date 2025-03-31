import { useQuery } from "@tanstack/react-query";
import { useActiveOrganization } from "./useActiveOrganization";
import { teamProjectsBySlugQueryOptions } from "../../projects/client/query-utils";

export function useActiveOrganizationProjects() {
	const activeOrganization = useActiveOrganization();
	return useQuery(
		teamProjectsBySlugQueryOptions(activeOrganization?.slug ?? "")
	);
}
