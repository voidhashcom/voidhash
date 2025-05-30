import { Page } from "@/features/shell";
import { Card } from "@voidhash/ui";
import { PaywallLocationRecordSkeleton } from "./paywall-location-record-skeleton";

export function PaywallLocationsPageSkeleton() {
	return (
		<Page>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<div className="flex flex-row items-center justify-between">
					<h1 className="text-3xl font-normal tracking-right">
						Paywall Locations
					</h1>
				</div>

				<p className="text-muted-foreground mt-3">
					Places throughout your app where paywalls can be shown.
				</p>

				<div className="mt-8">
					<Card className="divide-y grid p-0 gap-0">
						{Array.from({ length: 3 }).map((_, index) => (
							<PaywallLocationRecordSkeleton key={index} />
						))}
					</Card>
				</div>
			</div>
		</Page>
	);
}
