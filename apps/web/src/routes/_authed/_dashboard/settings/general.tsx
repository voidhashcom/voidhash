import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@voidhash/features/shell";

export const Route = createFileRoute("/_authed/_dashboard/settings/general")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Page
			breadcrumbs={[
				{
					title: "Settings",
					url: "/settings",
				},
				{
					title: "General",
					url: "/settings/general",
				},
			]}
		>
			<div>Hello</div>
		</Page>
	);
}
