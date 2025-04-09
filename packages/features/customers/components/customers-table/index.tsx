import { DataTableSkeleton } from "@voidhash/ui";
import { useCustomers } from "../../hooks/useCustomers";
import { columns } from "./columns";
import { DataTable } from "./data-table";

export function CustomersTable({
	projectId,
}: {
	projectId?: string | null;
}) {
	const { data: customers, isLoading } = useCustomers(projectId);

	if (isLoading) return <DataTableSkeleton />;
	if (!customers) return null;
	return <DataTable columns={columns} data={customers} />;
}
