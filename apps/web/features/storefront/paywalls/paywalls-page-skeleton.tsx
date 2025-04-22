import { Page } from "@/features/shell";
import { Card } from "@voidhash/ui";
import { PaywallRecordSkeleton } from "./paywall-record-skeleton";

export function PaywallsPageSkeleton() {
	return (
		<Page>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<div className="flex flex-row items-center justify-between">
					<h1 className="text-3xl font-normal tracking-right">Paywalls</h1>
				</div>

				<div className="mt-8">
					<Card className="divide-y grid p-0 gap-0">
						{Array.from({ length: 3 }).map((_, index) => (
							<PaywallRecordSkeleton key={index} />
						))}
					</Card>
				</div>
			</div>
		</Page>
	);
}
