import { CustomersPage } from "@/features/customers/list/customers-page";

export default async function Page({
	params,
}: {
	params: { organizationSlug: string; projectSlug: string };
}) {
	const { organizationSlug, projectSlug } = await params;
	return (
		<CustomersPage
			organizationSlug={organizationSlug}
			projectSlug={projectSlug}
		/>
	);
}
