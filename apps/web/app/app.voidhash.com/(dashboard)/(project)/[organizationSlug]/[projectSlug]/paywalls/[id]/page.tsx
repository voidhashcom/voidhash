import { PaywallsDetailPage } from "@/features/paywalls/paywalls-detail-page";

export default async function Page({
	params,
}: {
	params: Promise<{
		organizationSlug: string;
		projectSlug: string;
		id: string;
	}>;
}) {
	const { organizationSlug, projectSlug, id } = await params;

	return (
		<PaywallsDetailPage
			organizationSlug={organizationSlug}
			projectSlug={projectSlug}
			id={id}
		/>
	);
}
