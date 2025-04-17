import { ProductsPage } from "@/features/storefront/products/products-page";

export default async function Page({
	params,
}: {
	params;
}) {
	return <ProductsPage paramsPromise={params} />;
}
