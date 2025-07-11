import { Data, Effect } from "effect";
import { PaywallLocationRepository } from "../repositories/paywall-location.repository";
import { AuthSession } from "@/lib/services/auth.service";
import { Environment } from "@/lib/services/environment.service";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { PaywallRepository } from "../repositories/paywall.repository";
import { generateId } from "@/lib/id/generate";

export class SlugAlreadyExistsError extends Data.TaggedError(
	"SlugAlreadyExistsError",
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class DefaultPaywallNotFoundError extends Data.TaggedError(
	"DefaultPaywallNotFoundError",
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class PaywallLocationNotFound extends Data.TaggedError(
	"PaywallLocationNotFound",
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class PaywallLocationService extends Effect.Service<PaywallLocationService>()(
	"PaywallLocationService",
	{
		dependencies: [PaywallLocationRepository.Default],
		effect: Effect.gen(function* () {
			const paywallLocationRepository = yield* PaywallLocationRepository;
			return {
				createPaywallLocation: (input: {
					projectId: string;
					name: string;
					slug: string;
					defaultPaywallId: string;
				}) =>
					Effect.gen(function* () {
						const session = yield* AuthSession;
						const environment = yield* Environment;
						const paywallLocationRepository = yield* PaywallLocationRepository;
						const paywallRepository = yield* PaywallRepository;

						// SECURITY: Authorization check
						yield* checkProjectPermission(
							input.projectId,
							"project:all",
							`User ${session?.user?.id} is not authorized to create paywall locations for project ${input.projectId}`,
						);

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
								}),
							);
						}

						const defaultPaywall = yield* paywallRepository.getPaywallById(
							input.defaultPaywallId,
						);
						if (!defaultPaywall) {
							return yield* Effect.fail(
								new DefaultPaywallNotFoundError({
									message: "Default paywall not found",
								}),
							);
						}

						if (defaultPaywall.projectId !== input.projectId) {
							return yield* Effect.fail(
								new DefaultPaywallNotFoundError({
									message: "Default paywall not found",
								}),
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
							newPaywallLocation,
						);
						yield* Effect.log(
							`Created paywall location ${newPaywallLocation.id} for project ${input.projectId}`,
						);

						// TODO: Adding a perk should unlock it for existing users?

						return yield* Effect.succeed({
							id: newPaywallLocation.id,
						});
					}),

				getPaywallLocations: (projectId: string) =>
					Effect.gen(function* () {
						const session = yield* AuthSession;
						const environment = yield* Environment;

						// SECURITY: Authorization check
						yield* checkProjectPermission(
							projectId,
							"project:all",
							`User ${session?.user?.id} is not authorized to access paywall locations for project ${projectId}`,
						);

						return yield* paywallLocationRepository.getPaywallLocations({
							projectId,
							environment,
						});
					}),

				getPaywallLocationById: (id: string) =>
					Effect.gen(function* () {
						const session = yield* AuthSession;
						const paywallLocation =
							yield* paywallLocationRepository.getPaywallLocationById(id);
						if (!paywallLocation) {
							return yield* Effect.fail(
								new PaywallLocationNotFound({
									message: "Paywall location not found",
								}),
							);
						}
						// SECURITY: Authorization check
						yield* checkProjectPermission(
							paywallLocation.projectId,
							"project:all",
							`User ${session?.user?.id} is not authorized to access paywall location ${id} for project ${paywallLocation.projectId}`,
						);
						return paywallLocation;
					}),

				deletePaywallLocation: (input: { paywallLocationId: string }) =>
					Effect.gen(function* () {
						const session = yield* AuthSession;
						const paywallLocationRepository = yield* PaywallLocationRepository;
						const paywallLocation =
							yield* paywallLocationRepository.getPaywallLocationById(
								input.paywallLocationId,
							);
						if (!paywallLocation) {
							return yield* Effect.fail(
								new PaywallLocationNotFound({
									message: `Paywall location with id ${input.paywallLocationId} not found`,
								}),
							);
						}

						// SECURITY: Authorization check
						yield* checkProjectPermission(
							paywallLocation.projectId,
							"project:all",
							`User ${session?.user?.id} is not authorized to delete paywall location ${input.paywallLocationId}`,
						);

						yield* paywallLocationRepository.deletePaywallLocation(
							input.paywallLocationId,
						);
					}),
			};
		}),
	},
) {}
