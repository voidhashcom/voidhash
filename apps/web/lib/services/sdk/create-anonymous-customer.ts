import { Data, Effect, pipe, Schema } from "effect";
import { generateId } from "@/lib/id/generate";
import { Environment } from "@voidhash/lib/constants";
import { CustomerRepository } from "../customers/customer.repository";
import { CustomerOrigin, CustomerType, InsertCustomer } from "@voidhash/db";

export class CustomerCreationError extends Data.TaggedError(
	"CustomerCreationError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const createAnonymousCustomerInputSchema = Schema.Struct({
	projectId: Schema.String,
	appUserId: Schema.String,
	origin: Schema.Literal(CustomerOrigin.IOS, CustomerOrigin.Android),
	environment: Schema.Literal(Environment.Production, Environment.Testing),
});

type CreateAnonymousCustomerInput = Schema.Schema.Type<
	typeof createAnonymousCustomerInputSchema
>;

export const createAnonymousCustomer = (
	inputUnsafe: CreateAnonymousCustomerInput
) =>
	pipe(
		Effect.gen(function* () {
			const customerRepository = yield* CustomerRepository;
			const input = Schema.decodeUnknownSync(
				createAnonymousCustomerInputSchema
			)(inputUnsafe);

			const newCustomer = {
				id: generateId("customer"),
				type: CustomerType.Anonymous,
				parentCustomerId: null,
				projectId: input.projectId,
				appUserId: input.appUserId,
				origin: input.origin,
				environment: input.environment,
				name: null,
				email: null,
			} satisfies InsertCustomer;

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
