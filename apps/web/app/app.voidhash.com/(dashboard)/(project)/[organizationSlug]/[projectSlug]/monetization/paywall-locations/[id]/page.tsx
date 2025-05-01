import { PerksDetailPage } from "@/features/monetization/perks/perks-detail-page";

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
		<PerksDetailPage
			organizationSlug={organizationSlug}
			projectSlug={projectSlug}
			id={id}
		/>
	);
}
