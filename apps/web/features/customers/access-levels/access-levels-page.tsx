import { Page } from "@/features/shell";

export async function AccessLevelsPage({
	paramsPromise,
}: {
	paramsPromise: Promise<{
		projectSlug;
	}>;
}) {
	const { projectSlug } = await paramsPromise;
	return (
		<Page>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<h1 className="text-3xl font-normal tracking-right">Access Levels</h1>
				<p className="text-muted-foreground mt-3">TODO: Brainstorm</p>
				<div className="mt-8"></div>
			</div>
		</Page>
	);
}
