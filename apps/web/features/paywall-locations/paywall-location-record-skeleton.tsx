"use client";

import { Skeleton } from "@voidhash/ui";

export function PaywallLocationRecordSkeleton() {
	return (
		<div className="relative isolate group hover:bg-accent/30 px-6 py-4">
			<div className="flex flex-row items-center justify-between">
				<div className="flex items-start gap-4 flex-1">
					<div className="flex gap-2 flex-col">
						<div className="w-42">
							<Skeleton className="h-4 w-32" />
						</div>
						<div className="w-42">
							<Skeleton className="h-4 w-24" />
						</div>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<Skeleton className="h-8 w-8" />
				</div>
			</div>
		</div>
	);
}
