import { PerksPage } from "@/features/monetization/perks/perks-page";

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
		<PerksPage organizationSlug={organizationSlug} projectSlug={projectSlug} />
	);
}
