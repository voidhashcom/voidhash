import { Page } from "@/features/shell";
import { Card } from "@voidhash/ui";
import { ApiKeyRecord } from "./api-key-record";

export function ProjectApiKeysPage({
	projectSlug,
}: {
	projectSlug: string;
}) {
	const privateKey = "sk_test_51Np...";
	const publicKey = "pk_test_51Np...";

	return (
		<Page>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<h1 className="text-3xl font-normal tracking-right">API Keys</h1>
				<p className="text-muted-foreground mt-3">Manage your API keys</p>
				<div className="mt-8">
					<Card className="divide-y grid p-0 gap-0">
						<ApiKeyRecord apiKey={privateKey} />
						<ApiKeyRecord apiKey={publicKey} />
					</Card>
				</div>
			</div>
		</Page>
	);
}
