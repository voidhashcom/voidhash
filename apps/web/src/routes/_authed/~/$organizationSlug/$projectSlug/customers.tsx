import { Page } from "@voidhash/ui";

import { createFileRoute } from "@tanstack/react-router";
import { useCustomers } from "@voidhash/features/customers/client/hooks/useCustomers";
import { useActiveProject } from "@voidhash/features/shell/hooks/useActiveProject";
import { CustomersTable } from "@voidhash/features/customers/client/components/customers-table";

export const Route = createFileRoute(
	"/_authed/~/$organizationSlug/$projectSlug/customers"
)({
	component: RouteComponent,
});

function RouteComponent() {
	const activeProject = useActiveProject();
	const { data: customers } = useCustomers(activeProject?.id);
	return (
		<Page>
			<div className="max-w-7xl mx-auto">
				<h1 className="text-3xl font-normal tracking-right">Customers</h1>
				<div className="mt-4">
					<CustomersTable projectId={activeProject?.id} />
				</div>
			</div>
		</Page>
	);
}
