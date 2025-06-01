import { Card } from "@voidhash/ui";
import { PaywallLocationRecordSkeleton } from "./paywall-location-record-skeleton";

export function PaywallLocationsPageSkeleton() {
	return (
		<div>
			<div className="flex flex-row items-center justify-between pt-6">
				<div>
					<h2 className="text-xl font-normal tracking-right">
						Paywall Locations
					</h2>
					<p className="text-muted-foreground mt-1">
						Places throughout your app where paywalls can be shown.
					</p>
				</div>
			</div>
			<div className="mt-8">
				<Card className="divide-y grid p-0 gap-0">
					{Array.from({ length: 3 }).map((_, index) => (
						<PaywallLocationRecordSkeleton key={index} />
					))}
				</Card>
			</div>
		</div>
	);
}
