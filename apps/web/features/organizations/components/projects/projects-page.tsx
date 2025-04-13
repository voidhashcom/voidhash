import { Page } from "@/features/shell";
import { ProjectsList } from "./projects-list";
import { Suspense } from "react";
import { ProjectsSkeleton } from "./projects-skeleton";

export async function ProjectsPage({
	params,
}: {
	params: {
		organizationSlug: string;
	};
}) {
	const { organizationSlug } = params;

	return (
		<Page>
			<div className="max-w-4xl mx-auto">
				<h1 className="text-3xl font-normal tracking-right">Projects</h1>
				<p className="text-muted-foreground mt-3">
					All projects of organization {organizationSlug}
				</p>
				<div className="mt-8">
					<Suspense fallback={<ProjectsSkeleton />}>
						<ProjectsList organizationSlug={organizationSlug} />
					</Suspense>
				</div>
			</div>
		</Page>
	);
}
