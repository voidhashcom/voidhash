import { columns } from "./columns";
import { DataTable } from "./data-table";
import { getCustomers } from "@/lib/services/customers/queries";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";

export async function CustomersTable({
	projectId,
}: {
	projectId: string;
}) {
	const customers = await getCustomers({
		ctx: await createNextServiceContext(),
		input: { projectId: projectId },
	});

	return <DataTable columns={columns} data={customers} />;
}
