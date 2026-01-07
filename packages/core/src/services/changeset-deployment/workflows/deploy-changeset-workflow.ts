import { Activity, Workflow } from "@effect/workflow";
import {
  and,
  eq,
  paymentProviderConfigurationProducts,
  paymentProviderConfigurations,
  perks,
  productPerks,
  products,
} from "@voidhash/db";
import { Db } from "@voidhash/db/effect";
import {
  AuthSession,
  AuthSessionSchema,
  ChangesetSchema,
  sortChangeset,
} from "@voidhash/shared";
import { Effect, Schema } from "effect";

import { PaymentProviderProductService } from "../../payment-provider-products";
import { PerkService } from "../../perks";
import { ProductPerkService } from "../../product-perks";
import { ProductService } from "../../products";

class DeployChangesetError extends Schema.TaggedError<DeployChangesetError>(
  "DeployChangesetError"
)("DeployChangesetError", {
  message: Schema.String,
}) {}

export const DeployChangesetWorkflow = Workflow.make({
  error: DeployChangesetError,
  idempotencyKey: ({ deploymentId }) => deploymentId,
  name: "DeployChangesetWorkflow",
  payload: {
    authSession: AuthSessionSchema,
    changeset: ChangesetSchema,
    deploymentId: Schema.String,
    projectId: Schema.String,
  },
  success: Schema.Void,
});

export const DeployChangesetWorkflowLayer = DeployChangesetWorkflow.toLayer(
  Effect.fn(function* DeployChangesetWorkflowLayer(payload) {
    const db = yield* Db;
    const perkService = yield* PerkService;
    const productService = yield* ProductService;
    const productPerkService = yield* ProductPerkService;
    const paymentProviderProductService = yield* PaymentProviderProductService;

    const { projectId } = payload;

    const _getPerkIdBySlug = (db: Db) =>
      db.makeQuery((execute, slug: string) =>
        execute(
          async (db) =>
            await db.query.perks.findFirst({
              columns: { id: true },
              where: and(eq(perks.slug, slug), eq(perks.projectId, projectId)),
            })
        )
      );

    const _getProductIdBySlug = (db: Db) =>
      db.makeQuery((execute, slug: string) =>
        execute(
          async (db) =>
            await db.query.products.findFirst({
              columns: { id: true },
              where: and(
                eq(products.slug, slug),
                eq(products.projectId, projectId)
              ),
            })
        )
      );

    const _getPaymentProviderConfigurationByProviderId = (db: Db) =>
      db.makeQuery((execute, providerId: string) =>
        execute(
          async (db) =>
            await db.query.paymentProviderConfigurations.findFirst({
              columns: { id: true },
              where: and(
                eq(paymentProviderConfigurations.providerId, providerId),
                eq(paymentProviderConfigurations.projectId, projectId)
              ),
            })
        )
      );

    const _getPaymentProviderProductByProductIdAndPaymentProviderConfigurationId =
      (db: Db) =>
        db.makeQuery(
          (
            execute,
            {
              productId,
              paymentProviderConfigurationId,
            }: {
              productId: string;
              paymentProviderConfigurationId: string;
            }
          ) =>
            execute(
              async (db) =>
                await db.query.paymentProviderConfigurationProducts.findFirst({
                  columns: { id: true },
                  where: and(
                    eq(
                      paymentProviderConfigurationProducts.productId,
                      productId
                    ),
                    eq(
                      paymentProviderConfigurationProducts.paymentProviderConfigurationId,
                      paymentProviderConfigurationId
                    )
                  ),
                })
            )
        );

    // Cache for resolved IDs: type:slug -> id
    // Also stores key -> id for created items in this changeset
    // const referenceMap = new Map<string, string>();

    // const getResourceId = (type: string, identifier: string) =>
    //   Effect.gen(function* () {
    //     const cacheKey = `${type}:${identifier}`;
    //     const cached = referenceMap.get(cacheKey);
    //     if (cached) {
    //       return cached;
    //     }

    //     const cachedKey = referenceMap.get(identifier);
    //     if (cachedKey) {
    //       return cachedKey;
    //     }

    //     // Try to resolve from DB
    //     if (type === 'perk') {
    //       const lookup = db.makeQuery((execute) =>
    //         execute(async (db) =>
    //           db.query.perks.findFirst({
    //             where: and(
    //               eq(perks.slug, identifier),
    //               eq(perks.projectId, projectId)
    //             ),
    //             columns: { id: true }
    //           })
    //         )
    //       );
    //       const perk = yield* lookup();
    //       if (perk) {
    //         referenceMap.set(cacheKey, perk.id);
    //         return perk.id;
    //       }
    //     } else if (type === 'product') {
    //       const lookup = db.makeQuery((execute) =>
    //         execute(async (db) =>
    //           db.query.products.findFirst({
    //             where: and(
    //               eq(products.slug, identifier),
    //               eq(products.projectId, projectId)
    //             ),
    //             columns: { id: true }
    //           })
    //         )
    //       );
    //       const product = yield* lookup();
    //       if (product) {
    //         referenceMap.set(cacheKey, product.id);
    //         return product.id;
    //       }
    //     } else if (type === 'paymentProviderConfiguration') {
    //       const lookup = db.makeQuery((execute) =>
    //         execute(async (db) => {
    //           // Identifier is paymentProviderKey
    //           const config =
    //             await db.query.paymentProviderConfigurations.findFirst({
    //               where: and(
    //                 eq(
    //                   paymentProviderConfigurations.paymentProviderKey,
    //                   identifier
    //                 ),
    //                 eq(paymentProviderConfigurations.projectId, projectId)
    //               ),
    //               columns: { id: true }
    //             });
    //           if (config) {
    //             return config;
    //           }

    //           // Fallback: identifier as providerId
    //           return await db.query.paymentProviderConfigurations.findFirst({
    //             where: and(
    //               eq(paymentProviderConfigurations.providerId, identifier),
    //               eq(paymentProviderConfigurations.projectId, projectId)
    //             ),
    //             columns: { id: true }
    //           });
    //         })
    //       );
    //       const config = yield* lookup();
    //       if (config) {
    //         referenceMap.set(cacheKey, config.id);
    //         return config.id;
    //       }
    //     }

    //     return yield* Effect.dieMessage(
    //       `Could not resolve reference for ${type}:${identifier}`
    //     );
    //   }).pipe(
    //     Effect.catchTags({
    //       DatabaseError: (error) =>
    //         Effect.fail(
    //           new DeployChangesetError({
    //             message: `Database error while resolving reference ${type}:${identifier}: ${String(error.cause)}`
    //           })
    //         )
    //     })
    //   );

    const sortedChangeset = sortChangeset(payload.changeset);

    for (const change of sortedChangeset) {
      switch (change.changeType) {
        case "create-perk": {
          yield* Activity.make({
            error: DeployChangesetError,
            execute: perkService
              .createPerk({ ...change.payload, projectId })
              .pipe(
                Effect.provideService(AuthSession, payload.authSession),
                Effect.catchAll((error) =>
                  Effect.fail(
                    new DeployChangesetError({
                      message: `Failed to create perk ${change.key}: ${error instanceof Error ? error.message : String(error)}`,
                    })
                  )
                )
              ),
            name: `DeployChange-${change.changeType}-${change.key}`,
            success: Schema.Struct({ id: Schema.String }),
          }).pipe(
            Activity.retry({ times: 3 }),
            DeployChangesetWorkflow.withCompensation(
              Effect.fn(function* DeployChangesetWorkflowLayer(result) {
                yield* perkService.deletePerk({ perkId: result.id }).pipe(
                  Effect.provideService(AuthSession, payload.authSession),
                  Effect.catchAll((error) => Effect.logError(error))
                );
              })
            )
          );

          break;
        }

        case "update-perk": {
          yield* Activity.make({
            error: DeployChangesetError,
            execute: Effect.gen(function* execute() {
              const perk = yield* _getPerkIdBySlug(db)(change.payload.slug);
              if (!perk) {
                return yield* Effect.fail(
                  new DeployChangesetError({
                    message: `Perk not found for update ${change.key}`,
                  })
                );
              }
              return yield* perkService.updatePerk({
                ...change.payload,
                id: perk.id,
                projectId,
              });
            }).pipe(
              Effect.provideService(AuthSession, payload.authSession),
              Effect.catchAll((error) =>
                Effect.fail(
                  new DeployChangesetError({
                    message: `Failed to update perk ${change.key}: ${error instanceof Error ? error.message : String(error)}`,
                  })
                )
              )
            ),
            name: `DeployChange-${change.changeType}-${change.key}`,
            success: Schema.Struct({ id: Schema.String }),
          }).pipe(Activity.retry({ times: 3 }));
          break;
        }

        case "delete-perk": {
          yield* Activity.make({
            error: DeployChangesetError,
            execute: Effect.gen(function* execute() {
              const perk = yield* _getPerkIdBySlug(db)(change.payload.slug);
              if (!perk) {
                return yield* Effect.fail(
                  new DeployChangesetError({
                    message: `Perk not found for delete ${change.key}`,
                  })
                );
              }
              return yield* perkService.deletePerk({ perkId: perk.id });
            }).pipe(
              Effect.provideService(AuthSession, payload.authSession),
              Effect.catchAll((error) =>
                Effect.fail(
                  new DeployChangesetError({
                    message: `Failed to delete perk ${change.key}: ${error instanceof Error ? error.message : String(error)}`,
                  })
                )
              )
            ),
            name: `DeployChange-${change.changeType}-${change.key}`,
            success: Schema.Void,
          }).pipe(Activity.retry({ times: 3 }));
          break;
        }

        case "create-product": {
          yield* Activity.make({
            error: DeployChangesetError,
            execute: productService
              .createProduct({ ...change.payload, projectId })
              .pipe(
                Effect.provideService(AuthSession, payload.authSession),
                Effect.catchAll((error) =>
                  Effect.fail(
                    new DeployChangesetError({
                      message: `Failed to create product ${change.key}: ${error instanceof Error ? error.message : String(error)}`,
                    })
                  )
                )
              ),
            name: `DeployChange-${change.changeType}-${change.key}`,
            success: Schema.Struct({ id: Schema.String }),
          }).pipe(
            Activity.retry({ times: 3 }),
            DeployChangesetWorkflow.withCompensation(
              Effect.fn(function* DeployChangesetWorkflowLayer(result) {
                yield* productService.deleteProduct({ id: result.id }).pipe(
                  Effect.provideService(AuthSession, payload.authSession),
                  Effect.catchAll((error) => Effect.logError(error))
                );
              })
            )
          );
          break;
        }

        case "update-product": {
          yield* Activity.make({
            error: DeployChangesetError,
            execute: Effect.gen(function* execute() {
              const product = yield* _getProductIdBySlug(db)(
                change.payload.slug
              );
              if (!product) {
                return yield* Effect.fail(
                  new DeployChangesetError({
                    message: `Product not found for update ${change.key}`,
                  })
                );
              }
              return yield* productService.updateProduct({
                ...change.payload,
                id: product.id,
              });
            }).pipe(
              Effect.provideService(AuthSession, payload.authSession),
              Effect.catchAll((error) =>
                Effect.fail(
                  new DeployChangesetError({
                    message: `Failed to update product ${change.key}: ${error instanceof Error ? error.message : String(error)}`,
                  })
                )
              )
            ),
            name: `DeployChange-${change.changeType}-${change.key}`,
            success: Schema.Void,
          }).pipe(Activity.retry({ times: 3 }));
          break;
        }

        case "delete-product": {
          yield* Activity.make({
            error: DeployChangesetError,
            execute: Effect.gen(function* execute() {
              const product = yield* _getProductIdBySlug(db)(
                change.payload.slug
              );
              if (!product) {
                return yield* Effect.fail(
                  new DeployChangesetError({
                    message: `Product not found for create product perk ${change.key}`,
                  })
                );
              }
              return yield* productService.deleteProduct({ id: product.id });
            }).pipe(
              Effect.provideService(AuthSession, payload.authSession),
              Effect.catchAll((error) =>
                Effect.fail(
                  new DeployChangesetError({
                    message: `Failed to delete product ${change.key}: ${error instanceof Error ? error.message : String(error)}`,
                  })
                )
              )
            ),
            name: `DeployChange-${change.changeType}-${change.key}`,
            success: Schema.Void,
          }).pipe(Activity.retry({ times: 3 }));
          break;
        }

        case "create-product-perk": {
          yield* Activity.make({
            error: DeployChangesetError,
            execute: Effect.gen(function* execute() {
              const product = yield* _getProductIdBySlug(db)(
                change.payload.productSlug
              );
              if (!product) {
                return yield* Effect.fail(
                  new DeployChangesetError({
                    message: `Product not found for create product perk ${change.key}`,
                  })
                );
              }
              const perk = yield* _getPerkIdBySlug(db)(change.payload.perkSlug);
              if (!perk) {
                return yield* Effect.fail(
                  new DeployChangesetError({
                    message: `Perk not found for create product perk ${change.key}`,
                  })
                );
              }
              return yield* productPerkService.createProductPerk({
                perkId: perk.id,
                productId: product.id,
              });
            }).pipe(
              Effect.provideService(AuthSession, payload.authSession),
              Effect.catchAll((error) =>
                Effect.fail(
                  new DeployChangesetError({
                    message: `Failed to create product perk ${change.key}: ${error instanceof Error ? error.message : String(error)}`,
                  })
                )
              )
            ),
            name: `DeployChange-${change.changeType}-${change.key}`,
            success: Schema.Struct({ id: Schema.String }),
          }).pipe(
            Activity.retry({ times: 3 }),
            DeployChangesetWorkflow.withCompensation(
              Effect.fn(function* DeployChangesetWorkflowLayer(result) {
                yield* productPerkService
                  .deleteProductPerk({ id: result.id })
                  .pipe(
                    Effect.provideService(AuthSession, payload.authSession),
                    Effect.catchAll((error) => Effect.logError(error))
                  );
              })
            )
          );
          break;
        }

        case "delete-product-perk": {
          yield* Activity.make({
            error: DeployChangesetError,
            execute: Effect.gen(function* execute() {
              const product = yield* _getProductIdBySlug(db)(
                change.payload.productSlug
              );
              if (!product) {
                return yield* Effect.fail(
                  new DeployChangesetError({
                    message: `Product not found for delete product perk ${change.key}`,
                  })
                );
              }
              const perk = yield* _getPerkIdBySlug(db)(change.payload.perkSlug);
              if (!perk) {
                return yield* Effect.fail(
                  new DeployChangesetError({
                    message: `Perk not found for delete product perk ${change.key}`,
                  })
                );
              }

              const lookup = db.makeQuery((execute) =>
                execute(async (db) =>
                  db.query.productPerks.findFirst({
                    columns: { id: true },
                    where: and(
                      eq(productPerks.productId, product.id),
                      eq(productPerks.perkId, perk.id)
                    ),
                  })
                )
              );
              const productPerk = yield* lookup().pipe(
                Effect.catchTags({
                  DatabaseError: (error) =>
                    Effect.fail(
                      new DeployChangesetError({
                        message: `Database error while looking up product perk: ${String(error.cause)}`,
                      })
                    ),
                })
              );

              if (!productPerk) {
                return; // Already deleted
              }

              yield* productPerkService.deleteProductPerk({
                id: productPerk.id,
              });
            }).pipe(
              Effect.provideService(AuthSession, payload.authSession),
              Effect.catchAll((error) =>
                Effect.fail(
                  new DeployChangesetError({
                    message: `Failed to delete product perk ${change.key}: ${error instanceof Error ? error.message : String(error)}`,
                  })
                )
              )
            ),
            name: `DeployChange-${change.changeType}-${change.key}`,
            success: Schema.Void,
          }).pipe(Activity.retry({ times: 3 }));
          break;
        }

        case "create-payment-provider-product": {
          yield* Activity.make({
            error: DeployChangesetError,
            execute: Effect.gen(function* execute() {
              const product = yield* _getProductIdBySlug(db)(
                change.payload.productSlug
              );
              if (!product) {
                return yield* Effect.fail(
                  new DeployChangesetError({
                    message: `Product not found for create payment provider product ${change.key}`,
                  })
                );
              }

              const paymentProviderConfiguration =
                yield* _getPaymentProviderConfigurationByProviderId(db)(
                  change.payload.providerId
                );
              if (!paymentProviderConfiguration) {
                return yield* Effect.fail(
                  new DeployChangesetError({
                    message: `Payment provider configuration not found for create payment provider product ${change.key}`,
                  })
                );
              }

              return yield* paymentProviderProductService.createPaymentProviderProduct(
                {
                  configuration: change.payload.configuration as Record<
                    string,
                    unknown
                  >,
                  paymentProviderConfigurationId:
                    paymentProviderConfiguration.id,
                  productId: product.id,
                }
              );
            }).pipe(
              Effect.provideService(AuthSession, payload.authSession),
              Effect.catchAll((error) =>
                Effect.fail(
                  new DeployChangesetError({
                    message: `Failed to create payment provider product ${change.key}: ${error instanceof Error ? error.message : String(error)}`,
                  })
                )
              )
            ),
            name: `DeployChange-${change.changeType}-${change.key}`,
            success: Schema.Struct({ id: Schema.String }),
          }).pipe(
            Activity.retry({ times: 3 }),
            DeployChangesetWorkflow.withCompensation(
              Effect.fn(function* DeployChangesetWorkflowLayer(result) {
                yield* paymentProviderProductService
                  .deletePaymentProviderProduct({
                    id: result.id,
                  })
                  .pipe(
                    Effect.provideService(AuthSession, payload.authSession),
                    Effect.catchAll((error) => Effect.logError(error))
                  );
              })
            )
          );
          break;
        }

        case "update-payment-provider-product": {
          yield* Activity.make({
            error: DeployChangesetError,
            execute: Effect.gen(function* execute() {
              const product = yield* _getProductIdBySlug(db)(
                change.payload.productSlug
              );
              if (!product) {
                return yield* Effect.fail(
                  new DeployChangesetError({
                    message: `Product not found for update payment provider product ${change.key}`,
                  })
                );
              }
              const paymentProviderConfiguration =
                yield* _getPaymentProviderConfigurationByProviderId(db)(
                  change.payload.providerId
                );
              if (!paymentProviderConfiguration) {
                return yield* Effect.fail(
                  new DeployChangesetError({
                    message: `Payment provider configuration not found for update payment provider product ${change.key}`,
                  })
                );
              }

              const lookup = db.makeQuery((execute) =>
                execute(async (db) =>
                  db.query.paymentProviderConfigurationProducts.findFirst({
                    columns: { id: true },
                    where: and(
                      eq(
                        paymentProviderConfigurationProducts.productId,
                        product.id
                      ),
                      eq(
                        paymentProviderConfigurationProducts.paymentProviderConfigurationId,
                        paymentProviderConfiguration.id
                      )
                    ),
                  })
                )
              );
              const ppp = yield* lookup().pipe(
                Effect.catchTags({
                  DatabaseError: (error) =>
                    Effect.fail(
                      new DeployChangesetError({
                        message: `Database error while looking up payment provider product: ${String(error.cause)}`,
                      })
                    ),
                })
              );

              if (!ppp) {
                yield* Effect.fail(
                  new DeployChangesetError({
                    message: `Payment provider product not found for update ${change.key}`,
                  })
                );
                return;
              }

              return yield* paymentProviderProductService.updatePaymentProviderProduct(
                {
                  configuration: change.payload.configuration as Record<
                    string,
                    unknown
                  >,
                  id: ppp.id,
                }
              );
            }).pipe(
              Effect.provideService(AuthSession, payload.authSession),
              Effect.catchAll((error) =>
                Effect.fail(
                  new DeployChangesetError({
                    message: `Failed to update payment provider product ${change.key}: ${error instanceof Error ? error.message : String(error)}`,
                  })
                )
              )
            ),
            name: `DeployChange-${change.changeType}-${change.key}`,
            success: Schema.Void,
          }).pipe(Activity.retry({ times: 3 }));
          break;
        }

        case "delete-payment-provider-product": {
          yield* Activity.make({
            error: DeployChangesetError,
            execute: Effect.gen(function* execute() {
              const product = yield* _getProductIdBySlug(db)(
                change.payload.productSlug
              );
              if (!product) {
                return yield* Effect.fail(
                  new DeployChangesetError({
                    message: `Product not found for delete payment provider product ${change.key}`,
                  })
                );
              }
              const paymentProviderConfiguration =
                yield* _getPaymentProviderConfigurationByProviderId(db)(
                  change.payload.providerId
                );
              if (!paymentProviderConfiguration) {
                return yield* Effect.fail(
                  new DeployChangesetError({
                    message: `Payment provider configuration not found for delete payment provider product ${change.key}`,
                  })
                );
              }
              const ppp =
                yield* _getPaymentProviderProductByProductIdAndPaymentProviderConfigurationId(
                  db
                )({
                  paymentProviderConfigurationId:
                    paymentProviderConfiguration.id,
                  productId: product.id,
                });
              if (!ppp) {
                return yield* Effect.fail(
                  new DeployChangesetError({
                    message: `Payment provider product not found for delete payment provider product ${change.key}`,
                  })
                );
              }

              return yield* paymentProviderProductService.deletePaymentProviderProduct(
                {
                  id: ppp.id,
                }
              );
            }).pipe(
              Effect.provideService(AuthSession, payload.authSession),
              Effect.catchAll((error) =>
                Effect.fail(
                  new DeployChangesetError({
                    message: `Failed to delete payment provider product ${change.key}: ${error instanceof Error ? error.message : String(error)}`,
                  })
                )
              )
            ),
            name: `DeployChange-${change.changeType}-${change.key}`,
            success: Schema.Void,
          }).pipe(Activity.retry({ times: 3 }));
          break;
        }
      }
    }
  })
);
