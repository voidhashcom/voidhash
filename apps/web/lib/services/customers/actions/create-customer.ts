import { AuthSession } from "@/lib/effect/auth";
import { Environment } from "@/lib/effect/environment";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { Effect, pipe, Schema } from "effect";
import { generateId } from "@/lib/id/generate";
import { CustomerRepository } from "../customer.repository";
import { InsertCustomer } from "@voidhash/db";

export const createCustomerInputSchema = Schema.Struct({
	projectId: Schema.String,
	appUserId: Schema.String,
	name: Schema.NullishOr(Schema.String.pipe(Schema.minLength(3), Schema.maxLength(32))),
	email: Schema.NullishOr(Schema.String),
	origin: Schema.Union(Schema.Literal("dashboard"), Schema.Literal("ios"), Schema.Literal("android"), Schema.Literal("stripe"), Schema.Literal("api")),
});

type CreateCustomerInput = Schema.Schema.Type<typeof createCustomerInputSchema>;

export const createCustomer = (inputUnsafe: CreateCustomerInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const environment = yield* Environment;
			const customerRepository = yield* CustomerRepository;
			const input = Schema.decodeUnknownSync(createCustomerInputSchema)(
				inputUnsafe
			);

			// SECURITY: Authorization check
			yield* checkProjectPermission(
				input.projectId,
				"project:all",
				`User ${session?.user?.id} is not authorized to create customers for project ${input.projectId}`
			);

			const newCustomer = {
				id: generateId("customer"),
				projectId: input.projectId,
				appUserId: input.appUserId,
				type: "identified",
				name: input.name ?? null,
				email: input.email ?? null,
				parentCustomerId: null,
				origin: input.origin,
				environment: environment,
			} satisfies InsertCustomer;

			yield* customerRepository.createCustomer(newCustomer);
			return {
				...newCustomer,
				createdAt: new Date(),
				updatedAt: new Date(),
			};
		}),
		Environment.withEnvironment({
			projectId: inputUnsafe.projectId,
		}),
		AuthSession.withAuthSession()
	);