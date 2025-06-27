import { columns } from "./columns";
import { DataTable } from "./data-table";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { tryCatch } from "@/lib/try-catch";
import { NextjsRuntime } from "@/lib/effect/runtimes/nextjs";
import { CustomerService } from "@/lib/services/customers/customer-service";
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
	const customersResult = await tryCatch(
		NextjsRuntime.runPromise(
			pipe(
				CustomerService,
				Effect.flatMap((customerService) =>
					customerService.getCustomers({
						projectId,
						type: type,
					})
				)
			)
		)
	);

	if (customersResult.error) {
		return <VoidhashErrorCard error={customersResult.error} />;
	}

	const customers = customersResult.data;

	return (
		<DataTable
			columns={columns}
			data={customers}
			organizationSlug={organizationSlug}
			projectSlug={projectSlug}
		/>
	);
}
