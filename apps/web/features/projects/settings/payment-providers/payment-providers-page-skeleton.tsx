import { Page } from "@/features/shell";
import { paymentProviders } from "@/lib/payment-providers/paymentProviders";
import { Card, Skeleton } from "@voidhash/ui";

export function PaymentProvidersPageSkeleton() {
	return (
		<Page>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<h1 className="text-3xl font-normal tracking-right">
					Payment Providers
				</h1>
				<p className="text-muted-foreground mt-3">
					Configure your payment providers
				</p>
				<div className="mt-8">
					<Card className="divide-y grid p-0 gap-0">
						{paymentProviders?.map((paymentProvider) => (
							<div
								className="relative isolate group hover:bg-accent/30 px-6 py-4"
								key={paymentProvider.getId()}
							>
								<div className="flex flex-row items-center justify-between">
									<div className="flex items-center gap-4 flex-1">
										<div className="w-8 h-8">
											<Skeleton className="w-full h-full" />
										</div>
										<div className="flex flex-col">
											<Skeleton className="w-64 h-4" />
										</div>
									</div>
								</div>
							</div>
						))}
					</Card>
				</div>
			</div>
		</Page>
	);
}
