import { AuthSession } from "@/lib/effect/auth";
import { Environment } from "@/lib/effect/environment";
import { ForbiddenError } from "@/lib/effect/errors";
import { hasProjectPermission } from "@/lib/effect/permissions";
import { Data, Effect, pipe, Schema } from "effect";
import { generateId } from "@/lib/id/generate";
import { PaywallLocationRepository } from "../paywall-location-repository";
import { PaywallRepository } from "../../paywalls/paywall-repository";

export class SlugAlreadyExistsError extends Data.TaggedError(
	"SlugAlreadyExistsError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class DefaultPaywallNotFoundError extends Data.TaggedError(
	"DefaultPaywallNotFoundError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const createPaywallLocationInputSchema = Schema.Struct({
	projectId: Schema.String,
	name: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(32)),
	slug: Schema.String.pipe(
		Schema.minLength(3),
		Schema.maxLength(32),
		Schema.pattern(/^[a-z0-9_-]+$/)
	),
	defaultPaywallId: Schema.String,
});

type CreatePaywallLocationInput = Schema.Schema.Type<
	typeof createPaywallLocationInputSchema
>;

export const createPaywallLocation = (
	inputUnsafe: CreatePaywallLocationInput
) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const environment = yield* Environment;
			const paywallLocationRepository = yield* PaywallLocationRepository;
			const paywallRepository = yield* PaywallRepository;

			const input = Schema.decodeUnknownSync(createPaywallLocationInputSchema)(
				inputUnsafe
			);

			if (!hasProjectPermission(input.projectId, "project:all")) {
				yield* Effect.logWarning(
					`User ${session?.user?.id} is not authorized to create paywall locations for project ${input.projectId}`
				);
				return yield* Effect.fail(
					new ForbiddenError({
						message: "You are not authorized to create paywall locations",
					})
				);
			}

			const paywallLocation =
				yield* paywallLocationRepository.getPaywallLocationBySlug({
					slug: input.slug,
					projectId: input.projectId,
					environment: environment,
				});
			if (paywallLocation) {
				return yield* Effect.fail(
					new SlugAlreadyExistsError({
						message:
							"Paywall location with this slug already exists. Please choose a different slug.",
					})
				);
			}

			const defaultPaywall = yield* paywallRepository.getPaywallById(
				input.defaultPaywallId
			);
			if (!defaultPaywall) {
				return yield* Effect.fail(
					new DefaultPaywallNotFoundError({
						message: "Default paywall not found",
					})
				);
			}

			const newPaywallLocation = {
				id: generateId("paywallLocation"),
				slug: input.slug,
				projectId: input.projectId,
				name: input.name,
				environment: environment,
				defaultPaywallId: defaultPaywall.id,
			};

			yield* paywallLocationRepository.createPaywallLocation(
				newPaywallLocation
			);
			yield* Effect.log(
				`Created paywall location ${newPaywallLocation.id} for project ${input.projectId}`
			);

			// TODO: Adding a perk should unlock it for existing users?

			return yield* Effect.succeed({
				id: newPaywallLocation.id,
			});
		}),
		Environment.withEnvironment({
			projectId: inputUnsafe.projectId,
		}),
		AuthSession.withAuthSession()
	);
