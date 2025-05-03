import { CustomerDetailPage } from "@/features/customers/customers-detail-page";

export default async function CustomerPage({
	params,
}: {
	params: Promise<{
		id: string;
		organizationSlug: string;
		projectSlug: string;
	}>;
}) {
	const { id, organizationSlug, projectSlug } = await params;
	return (
		<CustomerDetailPage
			customerId={id}
			organizationSlug={organizationSlug}
			projectSlug={projectSlug}
		/>
	);
}
