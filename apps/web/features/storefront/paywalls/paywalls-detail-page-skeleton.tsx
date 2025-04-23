import { Page } from "@/features/shell";
import { SettingsCardSkeleton, Skeleton } from "@voidhash/ui";

export function PaywallsDetailPageSkeleton() {
	return (
		<Page
			breadcrumbs={[
				{
					title: "Paywalls",
				},
				{
					title: "Paywall",
					isLoading: true,
				},
			]}
		>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<div className="flex flex-row items-center justify-between">
					<Skeleton className="h-8 w-40" />
				</div>
				<div className="mt-8">
					<SettingsCardSkeleton />
				</div>
			</div>
		</Page>
	);
}
