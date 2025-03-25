import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@voidhash/features/shell";
import { DataTable } from "@voidhash/features/teams/components/settings/data-table";
import { invitationsColumns } from "@voidhash/features/teams/components/settings/pending-invites/columns";
import { XIcon } from "lucide-react";
export const Route = createFileRoute(
	"/_authed/_dashboard/settings/team/members"
)({
	component: RouteComponent,
});

function RouteComponent() {
	const handleCancelInvitation = () => {
		console.log("cancel invitation");
	};

	return (
		<Page
			breadcrumbs={[
				{ title: "Settings", url: "/settings" },
				{ title: "Team", url: "/settings/team" },
				{ title: "Members", url: "/settings/team/members" },
			]}
		>
			<DataTable
				columns={invitationsColumns}
				data={[]}
				emptyMessage="There are no outstanding invitations. You can invite another team member below."
				actions={[
					{
						onClick: handleCancelInvitation,
						label: "Cancel Invitation",
						icon: <XIcon size={16} />,
					},
				]}
			/>
		</Page>
	);
}
