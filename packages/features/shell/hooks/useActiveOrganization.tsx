"use client";

import { useParams } from "next/navigation";
import { useMe } from "../../auth/client/hooks/useMe";

export function useActiveOrganization() {
	const { data: me } = useMe();
	const { organizationSlug } = useParams();
	const organizations = me?.organizations ?? [];
	const activeOrganization = organizations.find(
		(organization) => organization.slug === organizationSlug
	);
	return activeOrganization;
}
