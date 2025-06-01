import { DevelopersTabBar } from "@/features/developers/developers-tab-bar";
import { Page } from "@/features/shell";

export default async function DevelopersLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{
		organizationSlug: string;
		projectSlug: string;
	}>;
}) {
	const { organizationSlug, projectSlug } = await params;

	const tabs = [
		{
			label: "Overview",
			path: `/${organizationSlug}/${projectSlug}/developers`,
		},
		{
			label: "API Keys",
			path: `/${organizationSlug}/${projectSlug}/developers/api-keys`,
		},
		{
			label: "Paywall Locations",
			path: `/${organizationSlug}/${projectSlug}/developers/paywall-locations`,
		},
		{
			label: "Perks",
			path: `/${organizationSlug}/${projectSlug}/developers/perks`,
		},
		{
			label: "Webhooks",
			path: `/${organizationSlug}/${projectSlug}/developers/webhooks`,
		},
	];

	return (
		<Page>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<div className="flex flex-row items-center justify-between">
					<h1 className="text-3xl font-normal tracking-right">Developers</h1>
				</div>
				{/* <p className="text-muted-foreground mt-3">
					List of products available to purchase.
				</p> */}

				<div className="mt-3">
					<DevelopersTabBar tabs={tabs} />
					{children}
				</div>
			</div>
		</Page>
	);
}
