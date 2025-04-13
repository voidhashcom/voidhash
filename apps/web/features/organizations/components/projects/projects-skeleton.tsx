import { Card, Skeleton } from "@voidhash/ui";

export function ProjectsSkeleton() {
	return (
		<Card className="divide-y grid p-0 gap-0">
			{Array.from({ length: 3 }).map((_, index) => (
				<div
					className="relative isolate group hover:bg-accent/30 px-6 py-4"
					key={index}
				>
					<div className="flex flex-row items-center justify-between">
						<div className="flex items-center gap-4">
							<Skeleton className="h-8 w-8 rounded-lg" />
							<div className="flex flex-col">
								<Skeleton className="h-4 w-32" />
							</div>
						</div>
					</div>
				</div>
			))}
		</Card>
	);
}
