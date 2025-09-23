import { zValidator } from '@hono/zod-validator';
import {
  authenticateWithPublishableKey,
  Environment,
  withEnvironmentFromApiKey
} from '@voidhash/core/services';
import { Effect } from 'effect';
import { describeRoute } from 'hono-openapi';
import { resolver } from 'hono-openapi/zod';
import { z } from 'zod';
import { openApiErrorResponses } from '@/lib/api/errors/openapi_responses';
import type { App } from '@/lib/api/hono/app';
import {
  createEffectHandler,
  HonoErrorResponse
} from '@/lib/effect/runtimes/hono';
import { AppStoreService } from '../services/app-store.service';

const appStoreValidateTransactionBodySchema = z.object({
  transactionId: z.string(),
  bundleId: z.string()
});

const appStoreValidateTransactionResponseSchema = z.object({
  success: z.boolean()
});

const route = describeRoute({
  description: 'Validates a transaction',
  operationId: 'appStoreValidateTransaction',
  security: [
    {
      publishableKey: []
    }
  ],
  responses: {
    200: {
      description: 'Successful response',
      content: {
        'application/json': {
          schema: resolver(appStoreValidateTransactionResponseSchema)
        }
      }
    },
    ...openApiErrorResponses
  },
  tags: ['App Store']
});

export type Route = typeof route;

export const registerAppStoreValidateTransaction = (app: App) =>
  app.post(
    '/v1/app-store/validate-transaction',
    route,
    zValidator('json', appStoreValidateTransactionBodySchema),
    async (c) =>
      createEffectHandler(c)(
        authenticateWithPublishableKey(
          withEnvironmentFromApiKey()(
            Effect.gen(function* () {
              const appStoreService = yield* AppStoreService;
              yield* appStoreService
                .validateTransaction({
                  transactionId: c.req.valid('json').transactionId,
                  bundleId: c.req.valid('json').bundleId,
                  environment: yield* Environment
                })
                .pipe(
                  // TODO: Properly handle errors
                  Effect.catchAll((error) => {
                    return Effect.gen(function* () {
                      return yield* Effect.fail(
                        new HonoErrorResponse({
                          code: 'INTERNAL_SERVER_ERROR',
                          message: 'Failed to validate transaction',
                          originalError: error
                        })
                      );
                    });
                  })
                );

              return c.json<
                z.infer<typeof appStoreValidateTransactionResponseSchema>
              >({
                success: true
              });
            })
          )
        )
      )
  );

// export const registerAppStoreValidateTransaction = (app: App) =>
// 	app.post(
// 		"/v1/app-store/validate-transaction",
// 		route,
// 		zValidator("json", appStoreValidateTransactionBodySchema),
// 		async (c) => {
// 			const context = c.get("services");
// 			const authenticatedContext = await authenticateContext(context);

// 			if (authenticatedContext.isErr()) {
// 				throw toVoidhashHTTPError(authenticatedContext.error);
// 			}

// 			const input = c.req.valid("json");

// 			const projectId = authenticatedContext.value.session?.projects[0]?.id;
// 			if (!projectId) {
// 				throw toVoidhashHTTPError({
// 					code: "INTERNAL_SERVER_ERROR",
// 					message: "Project ID does not exist in the session",
// 					originalError: new Error("Project ID does not exist in the session"),
// 				});
// 			}

// 			const matchingPaymentProviderConfigurations = await db
// 				.select()
// 				.from(paymentProviderConfigurations)
// 				.where(
// 					and(
// 						eq(
// 							paymentProviderConfigurations.providerId,
// 							appStorePaymentProviderId
// 						),
// 						eq(paymentProviderConfigurations.projectId, projectId),
// 						eq(paymentProviderConfigurations.enabled, true),
// 						eq(
// 							paymentProviderConfigurations.paymentProviderKey,
// 							appStore.createGlobalKey({
// 								bundleId: input.bundleId,
// 							})
// 						)
// 					)
// 				);

// 			if (matchingPaymentProviderConfigurations.length === 0) {
// 				throw toVoidhashHTTPError({
// 					code: "NOT_FOUND",
// 					message: "Payment provider configuration not found",
// 					resource: "paymentProviderConfiguration",
// 					payload: {
// 						projectId,
// 						providerId: appStorePaymentProviderId,
// 						paymentProviderKey: appStore.createGlobalKey({
// 							bundleId: input.bundleId,
// 						}),
// 					},
// 				} satisfies VoidhashNotFoundError);
// 			}

// 			const paymentProviderConfiguration =
// 				matchingPaymentProviderConfigurations[0]!;

// 			const configuration =
// 				paymentProviderConfiguration.configuration as z.infer<
// 					ReturnType<typeof appStore.getGlobalConfigurationSchema>
// 				>;

// 			const appStoreServerAPI = new AppStoreServerAPI(
// 				configuration.privateKey,
// 				configuration.keyId,
// 				configuration.issuerId,
// 				configuration.bundleId,
// 				Environment.Production
// 			);

// 			const transactionInfo = await safeTryPromise(async () => {
// 				const transactionInfoResponse =
// 					await appStoreServerAPI.getTransactionInfo(input.transactionId);
// 				return ok(transactionInfoResponse);
// 			});

// 			if (transactionInfo.isErr()) {
// 				throw toVoidhashHTTPError(transactionInfo.error);
// 			}

// 			const transaction = await safeTryPromise(async () => {
// 				const transaction = await decodeTransaction(
// 					transactionInfo.value.signedTransactionInfo
// 				);
// 				return ok(transaction);
// 			});

// 			if (transaction.isErr()) {
// 				throw toVoidhashHTTPError(transaction.error);
// 			}

// 			if (
// 				transaction.value.type !== TransactionType.AutoRenewableSubscription
// 			) {
// 				throw toVoidhashHTTPError({
// 					code: "BAD_REQUEST",
// 					message: "We do not currently support non-subscription transactions.",
// 				} satisfies VoidhashBadRequestError);
// 			}

// 			const paymentProviderConfigurationProductResult = await safeTryPromise(
// 				async () => {
// 					const paymentProviderConfigurationProduct =
// 						await context.db.query.paymentProviderConfigurationProducts.findFirst(
// 							{
// 								where: and(
// 									eq(
// 										paymentProviderConfigurationProducts.paymentProviderConfigurationId,
// 										paymentProviderConfiguration.id
// 									),
// 									eq(
// 										paymentProviderConfigurationProducts.providerProductKey,
// 										appStore.createProductKey({
// 											productId: transaction.value.productId,
// 										})
// 									)
// 								),
// 								with: {
// 									product: true,
// 								},
// 								// Prefer active products
// 								orderBy: [desc(paymentProviderConfigurationProducts.isActive)],
// 							}
// 						);
// 					return ok(paymentProviderConfigurationProduct);
// 				}
// 			);

// 			if (paymentProviderConfigurationProductResult.isErr()) {
// 				throw toVoidhashHTTPError(
// 					paymentProviderConfigurationProductResult.error
// 				);
// 			}

// 			const paymentProviderConfigurationProduct =
// 				paymentProviderConfigurationProductResult.value;

// 			if (!paymentProviderConfigurationProduct) {
// 				throw toVoidhashHTTPError({
// 					code: "NOT_FOUND",
// 					message: "Payment provider configuration product not found",
// 					resource: "paymentProviderConfigurationProduct",
// 					payload: {
// 						paymentProviderConfigurationId: paymentProviderConfiguration.id,
// 					},
// 				} satisfies VoidhashNotFoundError);
// 			}

// 			const customerId = transaction.value.appAccountToken;
// 			if (!customerId) {
// 				throw toVoidhashHTTPError({
// 					code: "BAD_REQUEST",
// 					message: "App account token not found",
// 				} satisfies VoidhashBadRequestError);
// 			}

// 			const currency = parseISO4217CurrencyCode(transaction.value.currency);
// 			if (currency.isErr()) {
// 				throw toVoidhashHTTPError({
// 					code: "BAD_REQUEST",
// 					message: "Invalid ISO 4217 currency code",
// 				} satisfies VoidhashBadRequestError);
// 			}

// 			// Process the transaction
// 			await safeTryPromise(async () => {
// 				return await context.db.transaction(async (tx: Transaction) => {
// 					const existingAppStoreTransaction =
// 						await tx.query.appStoreTransactions.findFirst({
// 							where: and(
// 								eq(
// 									appStoreTransactions.transactionId,
// 									transaction.value.transactionId
// 								)
// 							),
// 						});

// 					if (existingAppStoreTransaction) {
// 						// TODO: Handle existing transactions
// 						return ok();
// 					}

// 					await tx.insert(appStoreTransactions).values({
// 						id: generateId("appStoreTransaction"),
// 						transactionId: transaction.value.transactionId,
// 						currency: transaction.value.currency,
// 						environment: fromEnvironment(transaction.value.environment),
// 						expireDate: transaction.value.expiresDate
// 							? new Date(transaction.value.expiresDate)
// 							: null,
// 						inAppOwnershipType: fromOwnershipType(
// 							transaction.value.inAppOwnershipType
// 						),
// 						isUpgraded: transaction.value.isUpgraded,
// 						offerDiscountType: transaction.value.offerDiscountType
// 							? fromOfferDiscountType(transaction.value.offerDiscountType)
// 							: null,
// 						offerIdentifier: transaction.value.offerIdentifier,
// 						offerPeriod: transaction.value.offerPeriod,
// 						offerType: transaction.value.offerType
// 							? fromOfferType(transaction.value.offerType)
// 							: null,
// 						originalPurchaseDate: new Date(
// 							transaction.value.originalPurchaseDate
// 						),
// 						originalTransactionId: transaction.value.originalTransactionId,
// 						price: transaction.value.price,
// 						productId: transaction.value.productId,
// 						purchaseDate: new Date(transaction.value.purchaseDate),
// 						quantity: transaction.value.quantity,
// 						revocationDate: transaction.value.revocationDate
// 							? new Date(transaction.value.revocationDate)
// 							: null,
// 						revocationReason: transaction.value.revocationReason
// 							? fromRevocationReason(transaction.value.revocationReason)
// 							: null,
// 						storefront: transaction.value.storefront,
// 						storefrontId: transaction.value.storefrontId,
// 						subscriptionGroupIdentifier:
// 							transaction.value.subscriptionGroupIdentifier,
// 						transactionReason: transaction.value.transactionReason
// 							? fromTransactionReason(transaction.value.transactionReason)
// 							: null,
// 						type: fromTransactionType(transaction.value.type),
// 						webOrderLineItemId: transaction.value.webOrderLineItemId,
// 					});

// 					if (
// 						transaction.value.type ===
// 							TransactionType.AutoRenewableSubscription ||
// 						transaction.value.type === TransactionType.NonRenewingSubscription
// 					) {
// 						// Creation
// 						if (
// 							transaction.value.transactionReason === TransactionReason.Purchase
// 						) {
// 							await processSubscriptionCreation(
// 								{ ...context, tx },
// 								paymentProviderConfigurationProduct,
// 								{
// 									customerId,
// 									providerEnvironment:
// 										transaction.value.environment === Environment.Production
// 											? "production"
// 											: "sandbox",
// 									storeSubscriptionId: transaction.value.transactionId,
// 									isTrial: false,
// 									purchasedAt: new Date(),
// 									startsAt: new Date(),
// 									canceledAt: transaction.value.revocationDate
// 										? new Date(transaction.value.revocationDate)
// 										: null,
// 									cancelAtPeriodEnd: transaction.value.revocationDate
// 										? true
// 										: false,
// 									expiresAt: transaction.value.expiresDate
// 										? new Date(transaction.value.expiresDate)
// 										: null,
// 									transaction: {
// 										amount: transaction.value.price,
// 										currency: currency.value,
// 									},
// 								}
// 							);
// 						}

// 						// TODO: Handle renewal
// 						// TODO: Handle cancel
// 						// TODO: Handle refund
// 					}

// 					// TODO: Handle non-subscription transactions
// 					throw toVoidhashHTTPError({
// 						code: "BAD_REQUEST",
// 						message:
// 							"We do not currently support non-subscription transactions.",
// 					} satisfies VoidhashBadRequestError);
// 				});
// 			});

// 			return c.json<z.infer<typeof appStoreValidateTransactionResponseSchema>>({
// 				success: true,
// 			});
// 		}
// 	);
