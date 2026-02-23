import type { ChangesetSchema } from "@voidhash/shared";
import { Effect, Schedule } from "effect";

import { ApiClient } from "../../utils/api-client";
import {
	buildChangeset,
	formatChange,
} from "../../utils/schema/changeset-builder";
import { computeDiff, summarizeDiff } from "../../utils/schema/diff";
import { loadLocalSchema } from "../../utils/schema/local-schema-loader";
import {
	ChangeDeploymentError,
	RemoteSchemaFetchError,
} from "../errors/schema";
import {
	type ProviderId,
	createEmptyNormalizedSchema,
} from "../schema/normalized-schema";

// Re-export types for convenience
export type { SchemaDiff } from "../../utils/schema/diff";
export { formatChange } from "../../utils/schema/changeset-builder";

type Change = (typeof ChangesetSchema.Type)["changes"][number];

export class SchemaService extends Effect.Service<SchemaService>()(
	"voidhash-cli/Schema",
	{
		dependencies: [ApiClient.Default],
		effect: Effect.gen(function* effect() {
			const apiClient = yield* ApiClient;

			/**
			 * Fetch the remote schema from the API
			 */
			const fetchRemoteSchema = () =>
				Effect.gen(function* fetchRemoteSchema() {
					yield* Effect.logDebug("Fetching remote schema from API");
					const schema = createEmptyNormalizedSchema();

					// 1. Fetch all perks
					const remotePerks = yield* apiClient.perks.listPerks();
					for (const perk of remotePerks) {
						schema.perks.set(perk.slug, {
							name: perk.name,
							slug: perk.slug,
						});
					}

					// 1b. Fetch all active paywall locations
					const remoteLocations =
						yield* apiClient.paywall_locations.listPaywallLocations();
					for (const location of remoteLocations) {
						schema.locations.set(location.slug, {
							description: location.description,
							name: location.name,
							slug: location.slug,
						});
					}

					// 2. Fetch all products
					const remoteProducts = yield* apiClient.products.listProducts();

					// 3. Fetch payment provider configurations
					const providerConfigs =
						yield* apiClient.payment_provider_configurations.listPaymentProviderConfigurations();
					for (const config of providerConfigs) {
						if (
							config.providerId === "appleAppStore" ||
							config.providerId === "googlePlay"
						) {
							schema.enabledProviders.add(config.providerId);
						}
					}

					// 4. Fetch all payment provider products
					const providerProducts =
						yield* apiClient.payment_provider_products.listPaymentProviderProducts();

					// Build a map of productId -> provider products
					const productProviderMap = new Map<
						string,
						{ providerId: ProviderId; configuration: Record<string, unknown> }[]
					>();
					for (const pp of providerProducts) {
						if (
							pp.providerId !== "appleAppStore" &&
							pp.providerId !== "googlePlay"
						) {
							continue;
						}
						const existing = productProviderMap.get(pp.productId) || [];
						existing.push({
							configuration: pp.configuration as Record<string, unknown>,
							providerId: pp.providerId,
						});
						productProviderMap.set(pp.productId, existing);
					}

					// 5. For each product, fetch its perks

					yield* Effect.all(
						remoteProducts.map((product) =>
							Effect.gen(function* () {
								const productPerks = yield* apiClient.product_perks
									.listProductPerksByProductId({
										path: { productId: product.id },
									})
									.pipe(
										Effect.retry({
											schedule: Schedule.exponential(1000),
											times: 3,
										}),
									);

								// Map perkIds to slugs
								const perkSlugs: string[] = [];
								for (const pp of productPerks) {
									const perk = remotePerks.find((p) => p.id === pp.perkId);
									if (perk) {
										perkSlugs.push(perk.slug);
									}
								}

								schema.products.set(product.slug, {
									name: product.name,
									perks: perkSlugs,
									providers: productProviderMap.get(product.id) || [],
									slug: product.slug,
									type: "subscription", // TODO: map from product.type
								});
							}),
						),
						{
							concurrency: 8,
						},
					);

					yield* Effect.logDebug(
						`Fetched ${schema.locations.size} locations, ${schema.perks.size} perks, ${schema.products.size} products`
					);
					return schema;
				}).pipe(
					Effect.withSpan("SchemaService.fetchRemoteSchema"),
					Effect.catchAll(
						(e) =>
							new RemoteSchemaFetchError({
								cause: e,
							}),
					),
				);

			/**
			 * Fetch payment provider configurations
			 */
			const fetchProviderConfigurations = () =>
				apiClient.payment_provider_configurations
					.listPaymentProviderConfigurations()
					.pipe(
						Effect.tap((configs) =>
							Effect.logDebug(
								`Fetched ${configs.length} provider configurations`
							)
						),
						Effect.withSpan("SchemaService.fetchProviderConfigurations"),
						Effect.catchAll(
							(e) =>
								new RemoteSchemaFetchError({
									cause: e,
								}),
						),
					);
			/**
			 * Check which providers are missing configurations
			 */
			const checkProviderConfigurations = (
				localProviders: Set<ProviderId>,
				remoteConfigs: readonly { providerId: string }[],
			): ProviderId[] => {
				const remoteProviderIds = new Set(
					remoteConfigs.map((c) => c.providerId),
				);
				return [...localProviders].filter(
					(p) => !remoteProviderIds.has(p),
				) as ProviderId[];
			};

			/**
			 * Deploy a single change to the server
			 */
			const deployChange = (change: Change) =>
				Effect.logDebug(`Deploying change: ${formatChange(change)}`).pipe(
					Effect.andThen(
						apiClient.changesets.deployChangeset({
							payload: { changeset: { changes: [change] } },
						})
					),
					Effect.withSpan("SchemaService.deployChange"),
					Effect.catchAll(
						(e) =>
							new ChangeDeploymentError({
								cause: e,
								change: formatChange(change),
							})
					)
				);

			/**
			 * Deploy an entire changeset to the server
			 */
			const deployChangeset = (changeset: typeof ChangesetSchema.Type) =>
				Effect.logDebug(
					`Deploying changeset with ${changeset.changes.length} changes`
				).pipe(
					Effect.andThen(
						apiClient.changesets.deployChangeset({
							payload: { changeset },
						})
					),
					Effect.withSpan("SchemaService.deployChangeset"),
					Effect.catchAll(
						(e) =>
							new ChangeDeploymentError({
								cause: e,
								change: "Full changeset deployment",
							})
					)
				);

			return {
				buildChangeset,
				checkProviderConfigurations,
				computeDiff,
				deployChange,
				deployChangeset,
				fetchProviderConfigurations,
				fetchRemoteSchema,
				loadLocalSchema,
				summarizeDiff,
			} as const;
		}),
	},
) {}
