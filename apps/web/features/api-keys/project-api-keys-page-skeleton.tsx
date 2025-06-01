import { Card } from "@voidhash/ui";
import { ApiKeyRecordSkeleton } from "./api-key-record-skeleton";

export function ProjectApiKeysPageSkeleton() {
	return (
		<div>
			<div className="flex flex-row items-center justify-between pt-6">
				<div>
					<h2 className="text-xl font-normal tracking-right">API Keys</h2>
					<p className="text-muted-foreground mt-1">Manage your API keys</p>
				</div>
			</div>

			<div className="mt-8">
				<Card className="divide-y grid p-0 gap-0">
					{Array.from({ length: 3 }).map((_, index) => (
						<ApiKeyRecordSkeleton key={index} />
					))}
				</Card>
			</div>
		</div>
	);
}
