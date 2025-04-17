import { Page } from "@/features/shell/page";
import { Card } from "@voidhash/ui";
import { ApiKeyRecordSkeleton } from "./api-key-record-skeleton";

export function ProjectApiKeysPageSkeleton() {
	return (
		<Page>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<div className="flex flex-row items-center justify-between">
					<h1 className="text-3xl font-normal tracking-right">API Keys</h1>
				</div>
				<p className="text-muted-foreground mt-3">Manage your API keys</p>
				<div className="mt-8">
					<Card className="divide-y grid p-0 gap-0">
						{Array.from({ length: 3 }).map((_, index) => (
							<ApiKeyRecordSkeleton key={index} />
						))}
					</Card>
				</div>
			</div>
		</Page>
	);
}
