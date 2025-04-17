"use client";

import { Skeleton } from "@voidhash/ui";

export function ApiKeyRecordSkeleton() {
	return (
		<div className="relative isolate group hover:bg-accent/30 px-6 py-4">
			<div className="flex flex-row items-center justify-between">
				<div className="flex items-start gap-4 flex-1">
					<div className="w-42">
						<Skeleton className="h-4 w-24" />
					</div>

					<div className="w-64">
						<Skeleton className="h-4 w-full" />
					</div>
				</div>
			</div>
		</div>
	);
}
