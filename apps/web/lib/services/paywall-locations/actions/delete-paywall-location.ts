import { AuthSession } from "@/lib/effect/auth";
import { Data, Effect, pipe, Schema } from "effect";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { PaywallLocationRepository } from "../paywall-location.repository";

export class PaywallLocationNotFound extends Data.TaggedError(
	"PaywallLocationNotFound"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const deletePaywallLocationInputSchema = Schema.Struct({
	paywallLocationId: Schema.String,
});

type DeletePaywallLocationInput = Schema.Schema.Type<
	typeof deletePaywallLocationInputSchema
>;

export const deletePaywallLocation = (
	inputUnsafe: DeletePaywallLocationInput
) =>
	pipe(
		Effect.gen(function* () {
			const input = Schema.decodeUnknownSync(deletePaywallLocationInputSchema)(
				inputUnsafe
			);
			const session = yield* AuthSession;
			const paywallLocationRepository = yield* PaywallLocationRepository;
			const paywallLocation =
				yield* paywallLocationRepository.getPaywallLocationById(
					input.paywallLocationId
				);
			if (!paywallLocation) {
				return yield* Effect.fail(
					new PaywallLocationNotFound({
						message: `Paywall location with id ${input.paywallLocationId} not found`,
					})
				);
			}

			// SECURITY: Authorization check
			yield* checkProjectPermission(
				paywallLocation.projectId,
				"project:all",
				`User ${session?.user?.id} is not authorized to delete paywall location ${input.paywallLocationId}`
			);

			yield* paywallLocationRepository.deletePaywallLocation(
				input.paywallLocationId
			);
		}),
		AuthSession.withAuthSession()
	);
