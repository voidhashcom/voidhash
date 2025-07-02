import { columns } from "./columns";
import { DataTable } from "./data-table";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { CustomerService } from "@/lib/services/customers/customer.service";
import { Effect, pipe } from "effect";

export async function CustomersTable({
	projectId,
	type,
	organizationSlug,
	projectSlug,
}: {
	projectId: string;
	type?: "identified" | "anonymous";
	organizationSlug: string;
	projectSlug: string;
}) {
	const customersResult = await runServerEffect(
			pipe(
				CustomerService,
				Effect.flatMap((customerService) =>
					customerService.getCustomers({
						projectId,
						type: type,
					})
				)
		)
	);

	if (customersResult.isErr()) {
		return <VoidhashErrorCard error={customersResult._unsafeUnwrapErr()} />;
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
