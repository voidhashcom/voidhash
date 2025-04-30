import { PaywallsPage } from "@/features/monetization/paywalls/paywalls-page";

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
		<PaywallsPage
			organizationSlug={organizationSlug}
			projectSlug={projectSlug}
		/>
	);
}
