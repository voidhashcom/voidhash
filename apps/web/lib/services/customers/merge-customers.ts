import { Effect } from "effect";
import { CustomerRepository } from "./customer-repository";

export const mergeCustomers = (fromCustomerId: string, toCustomerId: string) =>
		Effect.gen(function* () {
			const customerRepository = yield* CustomerRepository;
			return yield* customerRepository.updateCustomer({
				id: fromCustomerId,
				parentCustomerId: toCustomerId,
				archivedAt: new Date(),
			});
		})

	