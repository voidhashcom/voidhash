import { columns } from "./columns";
import { DataTable } from "./data-table";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { AuthService, AuthSession } from "@/lib/services/auth.service";
import { CustomerService } from "@/lib/services/customer.service";
import {
	Environment,
	EnvironmentService,
} from "@/lib/services/environment.service";
import { CustomerTypeValue } from "@voidhash/db";
import { Effect } from "effect";

export async function CustomersTable({
	projectId,
	type,
	organizationSlug,
	projectSlug,
}: {
	projectId: string;
	type?: CustomerTypeValue;
	organizationSlug: string;
	projectSlug: string;
}) {
	const customersResult = await runServerEffect(
		Effect.gen(function* () {
			const authService = yield* AuthService;
			const customerService = yield* CustomerService;
			const environmentService = yield* EnvironmentService;
			const authSession = yield* authService.authenticateWithSession();
			return yield* AuthSession.provide(authSession)(
				Effect.gen(function* () {
					const environment =
						yield* environmentService.getEnvironmentFromCookie({
							projectId,
						});
					return yield* Environment.provide(environment)(
						customerService.getCustomers({
							projectId,
							type: type,
						})
					);
				})
			);
		})
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
