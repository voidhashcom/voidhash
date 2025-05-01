import { Page } from "@/features/shell";
import { Skeleton } from "@voidhash/ui";

export function PerksDetailPageSkeleton() {
	return (
		<Page
			breadcrumbs={[
				{
					title: "Perks",
				},
				{
					title: "Perk",
					isLoading: true,
				},
			]}
		>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<div className="flex flex-row items-center justify-between">
					<Skeleton className="h-8 w-40" />
				</div>
			</div>
		</Page>
	);
}
