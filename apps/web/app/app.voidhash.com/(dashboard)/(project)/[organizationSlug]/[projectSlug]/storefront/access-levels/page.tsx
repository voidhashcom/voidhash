import { AccessLevelsPage } from "@/features/storefront/access-levels/access-levels-page";

export default async function Page({
	params,
}: {
	params;
}) {
	return <AccessLevelsPage paramsPromise={params} />;
}
