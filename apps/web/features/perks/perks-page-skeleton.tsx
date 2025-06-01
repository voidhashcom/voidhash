import { Card } from "@voidhash/ui";
import { PerkRecordSkeleton } from "./perk-record-skeleton";

export function PerksPageSkeleton() {
	return (
		<div>
			<div className="flex flex-row items-center justify-between pt-6">
				<div>
					<h2 className="text-xl font-normal tracking-right">Perks</h2>
					<p className="text-muted-foreground mt-1">
						List of unlockable features / perks.
					</p>
				</div>
			</div>

			<div className="mt-8">
				<Card className="divide-y grid p-0 gap-0">
					{Array.from({ length: 3 }).map((_, index) => (
						<PerkRecordSkeleton key={index} />
					))}
				</Card>
			</div>
		</div>
	);
}
