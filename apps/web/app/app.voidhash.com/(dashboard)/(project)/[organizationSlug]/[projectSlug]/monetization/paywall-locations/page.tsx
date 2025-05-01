import { PaywallLocationsPage } from "@/features/monetization/paywall-locations/paywall-locations-page";

export default async function Page({
	params,
}: {
	params: Promise<{
		organizationSlug: string;
		projectSlug: string;
	}>;
}) {
	const { organizationSlug, projectSlug } = await params;
	return (
		<PaywallLocationsPage
			organizationSlug={organizationSlug}
			projectSlug={projectSlug}
		/>
	);
}
