import { AuthSession } from "@/lib/effect/auth";
import { Environment } from "@/lib/effect/environment";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { Effect, pipe, Schema } from "effect";
import { generateId } from "@/lib/id/generate";
import { PaywallRepository } from "../paywall.repository";

export const createPaywallInputSchema = Schema.Struct({
	projectId: Schema.String,
	name: Schema.String.pipe(
		Schema.minLength(3),
		Schema.maxLength(32)
	),
});

type CreatePaywallInput = Schema.Schema.Type<typeof createPaywallInputSchema>;

export const createPaywall = (inputUnsafe: CreatePaywallInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const environment = yield* Environment;
			const paywallRepository = yield* PaywallRepository;
			const input = Schema.decodeUnknownSync(createPaywallInputSchema)(
				inputUnsafe
			);

			// SECURITY: Authorization check
			yield* checkProjectPermission(
				input.projectId,
				"project:all",
				`User ${session?.user?.id} is not authorized to create paywalls for project ${input.projectId}`
			);

			const newPaywall = {
				id: generateId("paywall"),
				projectId: input.projectId,
				name: input.name,
				environment: environment,
			};

			yield* paywallRepository.createPaywall(newPaywall);
			yield* Effect.log(
				`Created paywall ${newPaywall.id} for project ${input.projectId}`
			);

			return yield* Effect.succeed({
				id: newPaywall.id,
			});
		}),
		Environment.withEnvironment({
			projectId: inputUnsafe.projectId,
		}),
		AuthSession.withAuthSession()
	);
