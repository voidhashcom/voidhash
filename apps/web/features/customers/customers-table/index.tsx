import { columns } from "./columns";
import { DataTable } from "./data-table";
import { getCustomers } from "@/lib/services/customers/queries";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";

export async function CustomersTable({
	projectId,
	hasAppUserId,
	organizationSlug,
	projectSlug,
}: {
	projectId: string;
	hasAppUserId?: boolean;
	organizationSlug: string;
	projectSlug: string;
}) {
	const customersResult = await getCustomers({
		ctx: await createNextServiceContext(),
		input: { projectId: projectId, hasAppUserId: hasAppUserId },
	});

	if (customersResult.isErr()) {
		const error = customersResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const customers = customersResult.value;

	return (
		<DataTable
			columns={columns}
			data={customers}
			organizationSlug={organizationSlug}
			projectSlug={projectSlug}
		/>
	);
}
