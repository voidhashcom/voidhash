import { Page } from "@/features/shell";

export function ProjectSettingsGeneralLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<Page>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<h1 className="text-3xl font-normal tracking-right">
					Project Settings
				</h1>
				<p className="text-muted-foreground mt-3">All settings for project</p>

				{children}
			</div>
		</Page>
	);
}
