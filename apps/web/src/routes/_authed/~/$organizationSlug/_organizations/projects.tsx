import { createFileRoute, useParams } from "@tanstack/react-router";
import { Card, CardHeader, CardTitle, Page } from "@voidhash/ui";

export const Route = createFileRoute(
	"/_authed/~/$organizationSlug/_organizations/projects"
)({
	component: RouteComponent,
});

function RouteComponent() {
	const { organizationSlug } = useParams({ strict: false });
	return (
		<Page>
			<div className="max-w-4xl mx-auto">
				<h1 className="text-3xl font-normal tracking-right">Projects</h1>
				<p className="text-muted-foreground mt-3">
					All projects of organization {organizationSlug}
				</p>
				<div className="grid grid-cols-3 gap-4 mt-8">
					<Card>
						<CardHeader>
							<CardTitle>Project 1</CardTitle>
						</CardHeader>
					</Card>
				</div>
			</div>
		</Page>
	);
}
