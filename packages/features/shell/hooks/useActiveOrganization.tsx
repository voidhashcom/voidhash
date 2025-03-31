import { useMe } from "../../auth/client/hooks/useMe";
import { useParams } from "@tanstack/react-router";

export function useActiveOrganization() {
	const { data: me } = useMe();
	const { organizationSlug } = useParams({ strict: false });
	const organizations = me?.organizations ?? [];
	const activeOrganization = organizations.find(
		(organization) => organization.slug === organizationSlug
	);
	return activeOrganization;
}
