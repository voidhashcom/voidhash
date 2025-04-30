import { ProductDetailPage } from "@/features/monetization/products/product-detail-page";

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
		<ProductDetailPage
			organizationSlug={organizationSlug}
			projectSlug={projectSlug}
			id={id}
		/>
	);
}
