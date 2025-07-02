import { Data, Effect, pipe, Schema } from "effect";
import { generateId } from "@/lib/id/generate";
import { Environment } from "@voidhash/lib/constants";
import { CustomerRepository } from "../customers/customer.repository";

export class CustomerCreationError extends Data.TaggedError("CustomerCreationError")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const createAnonymousCustomerInputSchema = Schema.Struct({
	projectId: Schema.String,
	appUserId: Schema.String,
	origin: Schema.Literal("ios", "android"),
	environment: Schema.String,
});

type CreateAnonymousCustomerInput = Schema.Schema.Type<typeof createAnonymousCustomerInputSchema>;

export const createAnonymousCustomer = (inputUnsafe: CreateAnonymousCustomerInput) =>
	pipe(
		Effect.gen(function* () {
			const customerRepository = yield* CustomerRepository;
			const input = Schema.decodeUnknownSync(createAnonymousCustomerInputSchema)(
				inputUnsafe
			);

			const newCustomer = {
				id: generateId("customer"),
				type: "anonymous" as const,
				parentCustomerId: null,
				projectId: input.projectId,
				appUserId: input.appUserId,
				origin: input.origin,
				environment: input.environment as Environment,
				name: null,
				email: null,
			};

			yield* customerRepository.createCustomer(newCustomer);

			yield* Effect.log(
				`Created anonymous customer ${newCustomer.id} for app user ${input.appUserId}`
			);

			return yield* Effect.succeed({
				...newCustomer,
				archivedAt: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		})
	); 