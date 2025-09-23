'use server';
import 'server-only';

import {
  ApiKeyService,
  authenticateWithSession,
  CustomerService,
  Environment,
  EnvironmentService,
  OrganizationService,
  PaymentProviderProductService,
  PaymentProviderService,
  PaywallLocationService,
  PaywallService,
  PerkService,
  ProductService,
  ProjectService,
  withEnvironmentFromCookie
} from '@voidhash/core/services';
import { CustomerOrigin } from '@voidhash/db';
import type { EnvironmentValue } from '@voidhash/lib/constants';
import { Effect, Either, pipe, Schema } from 'effect';
import { actionClient } from '@/lib/safe-action';
import { headers } from '../effect/headers';
import { NextjsErrorResponse, ServerAction } from '../nextjs-runtime';
import {
  createCustomerInputSchema,
  createOrganizationInputSchema,
  createPaymentProviderConfigurationInputSchema,
  createPaymentProviderProductInputSchema,
  createPaywallInputSchema,
  createPaywallLocationInputSchema,
  createPerkInputSchema,
  createProductInputSchema,
  createProductPerkInputSchema,
  createProjectInputSchema,
  createSecretKeyInputSchema,
  deleteOrganizationInputSchema,
  deletePaymentProviderConfigurationInputSchema,
  deletePaymentProviderProductInputSchema,
  deletePaywallInputSchema,
  deletePaywallLocationInputSchema,
  deletePerkInputSchema,
  deleteProductInputSchema,
  deleteProductPerkInputSchema,
  deleteProjectInputSchema,
  deleteSecretKeyInputSchema,
  rotateSecretKeyInputSchema,
  setActivePaymentProviderProductInputSchema,
  switchEnvironmentInputSchema,
  updateOrganizationInputSchema,
  updatePaymentProviderConfigurationInputSchema,
  updatePaymentProviderProductInputSchema,
  updatePaywallInputSchema,
  updateProductInputSchema,
  updateProjectInputSchema
} from './schema';

// Api keys
const _createSecretKeyAction = Effect.fn('createSecretKeyAction')(
  function* (input: { projectId: string; name: string }) {
    const res = yield* Effect.either(
      authenticateWithSession(yield* headers)(
        withEnvironmentFromCookie({ projectId: input.projectId })(
          pipe(
            ApiKeyService,
            Effect.flatMap((apiKeyService) =>
              apiKeyService.createSecretKey(input)
            )
          )
        )
      )
    );

    if (Either.isLeft(res)) {
      throw res.left;
    }

    return res.right;
  }
);
export const createSecretKeyAction = actionClient
  .inputSchema(Schema.standardSchemaV1(createSecretKeyInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_createSecretKeyAction)(parsedInput)
  );

const _rotateSecretKeyAction = Effect.fn('rotateSecretKeyAction')(
  function* (input: { secretKeyId: string }) {
    const res = yield* Effect.either(
      authenticateWithSession(yield* headers)(
        Effect.gen(function* () {
          const apiKeyService = yield* ApiKeyService;
          return yield* apiKeyService.rotateSecretKey(input).pipe(
            Effect.catchTags({
              ApiKeyNotFoundError: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'NOT_FOUND',
                    message: error.message
                  })
                )
            })
          );
        })
      )
    );

    if (Either.isLeft(res)) {
      throw res.left;
    }

    return res.right;
  }
);
export const rotateSecretKeyAction = actionClient
  .inputSchema(Schema.standardSchemaV1(rotateSecretKeyInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_rotateSecretKeyAction)(parsedInput)
  );

const _deleteSecretKeyAction = Effect.fn('deleteSecretKeyAction')(
  function* (input: { secretKeyId: string }) {
    const res = yield* Effect.either(
      authenticateWithSession(yield* headers)(
        Effect.gen(function* () {
          const apiKeyService = yield* ApiKeyService;
          return yield* apiKeyService.deleteSecretKey(input).pipe(
            Effect.catchTags({
              ApiKeyNotFoundError: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'NOT_FOUND',
                    message: error.message
                  })
                )
            })
          );
        })
      )
    );

    if (Either.isLeft(res)) {
      throw res.left;
    }

    return res.right;
  }
);
export const deleteSecretKeyAction = actionClient
  .inputSchema(Schema.standardSchemaV1(deleteSecretKeyInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_deleteSecretKeyAction)(parsedInput)
  );

// Organization
const _createOrganizationAction = Effect.fn('createOrganizationAction')(
  function* (input: { name: string }) {
    const res = yield* Effect.either(
      authenticateWithSession(yield* headers)(
        Effect.gen(function* () {
          const organizationService = yield* OrganizationService;
          return yield* organizationService
            .createOrganization(input, yield* headers)
            .pipe(
              Effect.catchTags({
                FailedToCreateOrganizationError: (error) =>
                  Effect.fail(
                    new NextjsErrorResponse({
                      code: 'INTERNAL_SERVER_ERROR',
                      message: error.message
                    })
                  ),
                UserSessionNotFoundError: (error) =>
                  Effect.fail(
                    new NextjsErrorResponse({
                      code: 'INTERNAL_SERVER_ERROR',
                      message: error.message
                    })
                  )
              })
            );
        })
      )
    );

    if (Either.isLeft(res)) {
      throw res.left;
    }

    return res.right;
  }
);
export const createOrganizationAction = actionClient
  .inputSchema(Schema.standardSchemaV1(createOrganizationInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_createOrganizationAction)(parsedInput)
  );

const _updateOrganizationAction = Effect.fn('updateOrganizationAction')(
  function* (input: { organizationId: string; name: string }) {
    const res = yield* Effect.either(
      authenticateWithSession(yield* headers)(
        Effect.gen(function* () {
          const organizationService = yield* OrganizationService;
          return yield* organizationService
            .updateOrganization(input, yield* headers)
            .pipe(
              Effect.catchTags({
                OrganizationNotFound: (error) =>
                  Effect.fail(
                    new NextjsErrorResponse({
                      code: 'NOT_FOUND',
                      message: error.message
                    })
                  )
              })
            );
        })
      )
    );

    if (Either.isLeft(res)) {
      throw res.left;
    }

    return res.right;
  }
);
export const updateOrganizationAction = actionClient
  .inputSchema(Schema.standardSchemaV1(updateOrganizationInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_updateOrganizationAction)(parsedInput)
  );

const _deleteOrganizationAction = Effect.fn('deleteOrganizationAction')(
  function* (input: { organizationId: string }) {
    const heads = yield* headers;
    const res = yield* Effect.either(
      authenticateWithSession(heads)(
        Effect.gen(function* () {
          const organizationService = yield* OrganizationService;
          return yield* organizationService.deleteOrganization(input, heads);
        })
      )
    );

    if (Either.isLeft(res)) {
      throw res.left;
    }

    return res.right;
  }
);
export const deleteOrganizationAction = actionClient
  .inputSchema(Schema.standardSchemaV1(deleteOrganizationInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_deleteOrganizationAction)(parsedInput)
  );

// Project
const _createProjectAction = Effect.fn('createProjectAction')(
  function* (input: { name: string; organizationId: string }) {
    const res = yield* Effect.either(
      authenticateWithSession(yield* headers)(
        Effect.gen(function* () {
          const projectService = yield* ProjectService;
          return yield* projectService.createProject(input);
        })
      )
    );

    if (Either.isLeft(res)) {
      throw res.left;
    }

    return res.right;
  }
);
export const createProjectAction = actionClient
  .inputSchema(Schema.standardSchemaV1(createProjectInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_createProjectAction)(parsedInput)
  );

const _updateProjectAction = Effect.fn('updateProjectAction')(
  function* (input: { id: string; name: string }) {
    const res = yield* Effect.either(
      authenticateWithSession(yield* headers)(
        Effect.gen(function* () {
          const projectService = yield* ProjectService;
          return yield* projectService.updateProject(input).pipe(
            Effect.catchTags({
              ProjectNotFound: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'NOT_FOUND',
                    message: error.message
                  })
                )
            })
          );
        })
      )
    );

    if (Either.isLeft(res)) {
      throw res.left;
    }

    return res.right;
  }
);
export const updateProjectAction = actionClient
  .inputSchema(Schema.standardSchemaV1(updateProjectInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_updateProjectAction)(parsedInput)
  );

const _deleteProjectAction = Effect.fn('deleteProjectAction')(
  function* (input: { id: string }) {
    const res = yield* Effect.either(
      authenticateWithSession(yield* headers)(
        Effect.gen(function* () {
          const projectService = yield* ProjectService;
          return yield* projectService.deleteProject(input).pipe(
            Effect.catchTags({
              ProjectNotFound: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'NOT_FOUND',
                    message: error.message
                  })
                )
            })
          );
        })
      )
    );

    if (Either.isLeft(res)) {
      throw res.left;
    }

    return res.right;
  }
);
export const deleteProjectAction = actionClient
  .inputSchema(Schema.standardSchemaV1(deleteProjectInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_deleteProjectAction)(parsedInput)
  );

// Environment
const _switchEnvironmentAction = Effect.fn('switchEnvironmentAction')(
  function* (input: { projectId: string; environment: EnvironmentValue }) {
    const res = yield* Effect.either(
      authenticateWithSession(yield* headers)(
        Effect.gen(function* () {
          const environmentService = yield* EnvironmentService;
          return yield* environmentService.switchEnvironment(input).pipe(
            Effect.catchTags({
              ProjectNotFoundError: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'NOT_FOUND',
                    message: error.message
                  })
                ),
              OrganizationNotFoundError: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'NOT_FOUND',
                    message: error.message
                  })
                ),
              OrganizationWithoutSlugError: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error.message
                  })
                )
            })
          );
        })
      )
    );

    if (Either.isLeft(res)) {
      throw res.left;
    }

    return res.right;
  }
);
export const switchEnvironmentAction = actionClient
  .inputSchema(Schema.standardSchemaV1(switchEnvironmentInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_switchEnvironmentAction)(parsedInput)
  );

// Payment providers
const _createPaymentProviderConfigurationAction = Effect.fn(
  'createPaymentProviderConfigurationAction'
)(function* (input: { projectId: string; providerId: string }) {
  const res = yield* Effect.either(
    authenticateWithSession(yield* headers)(
      Effect.gen(function* () {
        const paymentProviderService = yield* PaymentProviderService;
        return yield* paymentProviderService
          .createPaymentProviderConfiguration(input)
          .pipe(
            Effect.catchTags({
              PaymentProviderNotFoundError: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'NOT_FOUND',
                    message: error.message
                  })
                ),
              PaymentProviderAlreadyExistsError: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'BAD_REQUEST',
                    message: error.message
                  })
                )
            })
          );
      })
    )
  );

  if (Either.isLeft(res)) {
    throw res.left;
  }

  return res.right;
});
export const createPaymentProviderConfigurationAction = actionClient
  .inputSchema(
    Schema.standardSchemaV1(createPaymentProviderConfigurationInputSchema)
  )
  .action(async ({ parsedInput }) =>
    ServerAction.build(_createPaymentProviderConfigurationAction)(parsedInput)
  );

const _updatePaymentProviderConfigurationAction = Effect.fn(
  'updatePaymentProviderConfigurationAction'
)(function* (input: {
  id: string;
  enabled: boolean;
  name?: string;
  configuration: Record<string, unknown>;
}) {
  const res = yield* Effect.either(
    authenticateWithSession(yield* headers)(
      Effect.gen(function* () {
        const paymentProviderService = yield* PaymentProviderService;
        return yield* paymentProviderService
          .updatePaymentProviderConfiguration(input)
          .pipe(
            Effect.catchTags({
              PaymentProviderConfigurationNotFound: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'NOT_FOUND',
                    message: error.message
                  })
                ),
              PaymentProviderNotFoundError: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'NOT_FOUND',
                    message: error.message
                  })
                ),
              ParseError: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'BAD_REQUEST',
                    message: error.message
                  })
                ),

              PaymentProviderKeyUnavailableError: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'BAD_REQUEST',
                    message: error.message
                  })
                )
            })
          );
      })
    )
  );

  if (Either.isLeft(res)) {
    throw res.left;
  }

  return res.right;
});
export const updatePaymentProviderConfigurationAction = actionClient
  .inputSchema(
    Schema.standardSchemaV1(updatePaymentProviderConfigurationInputSchema)
  )
  .action(async ({ parsedInput }) =>
    ServerAction.build(_updatePaymentProviderConfigurationAction)(parsedInput)
  );

const _deletePaymentProviderConfigurationAction = Effect.fn(
  'deletePaymentProviderConfigurationAction'
)(function* (input: { paymentProviderConfigurationId: string }) {
  const res = yield* Effect.either(
    authenticateWithSession(yield* headers)(
      Effect.gen(function* () {
        const paymentProviderService = yield* PaymentProviderService;
        return yield* paymentProviderService
          .deletePaymentProviderConfiguration(input)
          .pipe(
            Effect.catchTags({
              PaymentProviderConfigurationNotFound: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'NOT_FOUND',
                    message: error.message
                  })
                )
            })
          );
      })
    )
  );

  if (Either.isLeft(res)) {
    throw res.left;
  }

  return res.right;
});
export const deletePaymentProviderConfigurationAction = actionClient
  .inputSchema(
    Schema.standardSchemaV1(deletePaymentProviderConfigurationInputSchema)
  )
  .action(async ({ parsedInput }) =>
    ServerAction.build(_deletePaymentProviderConfigurationAction)(parsedInput)
  );

// Products
const _createProductAction = Effect.fn('createProductAction')(
  function* (input: { projectId: string; name: string }) {
    const res = yield* Effect.either(
      authenticateWithSession(yield* headers)(
        withEnvironmentFromCookie({ projectId: input.projectId })(
          Effect.gen(function* () {
            const productService = yield* ProductService;
            return yield* productService.createProduct(input);
          })
        )
      )
    );

    if (Either.isLeft(res)) {
      throw res.left;
    }

    return res.right;
  }
);
export const createProductAction = actionClient
  .inputSchema(Schema.standardSchemaV1(createProductInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_createProductAction)(parsedInput)
  );

const _updateProductAction = Effect.fn('updateProductAction')(
  function* (input: { productId: string; name: string }) {
    const res = yield* Effect.either(
      authenticateWithSession(yield* headers)(
        Effect.gen(function* () {
          const productService = yield* ProductService;
          return yield* productService.updateProduct(input).pipe(
            Effect.catchTags({
              ProductNotFound: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'NOT_FOUND',
                    message: error.message
                  })
                )
            })
          );
        })
      )
    );

    if (Either.isLeft(res)) {
      throw res.left;
    }

    return res.right;
  }
);
export const updateProductAction = actionClient
  .inputSchema(Schema.standardSchemaV1(updateProductInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_updateProductAction)(parsedInput)
  );

const _deleteProductAction = Effect.fn('deleteProductAction')(
  function* (input: { productId: string }) {
    const res = yield* Effect.either(
      authenticateWithSession(yield* headers)(
        Effect.gen(function* () {
          const productService = yield* ProductService;
          return yield* productService.deleteProduct(input).pipe(
            Effect.catchTags({
              ProductNotFound: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'NOT_FOUND',
                    message: error.message
                  })
                )
            })
          );
        })
      )
    );

    if (Either.isLeft(res)) {
      throw res.left;
    }

    return res.right;
  }
);
export const deleteProductAction = actionClient
  .inputSchema(Schema.standardSchemaV1(deleteProductInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_deleteProductAction)(parsedInput)
  );

// Product perks
const _createProductPerkAction = Effect.fn('createProductPerkAction')(
  function* (input: { productId: string; perkId: string }) {
    const res = yield* Effect.either(
      authenticateWithSession(yield* headers)(
        Effect.gen(function* () {
          const productService = yield* ProductService;
          return yield* productService.createProductPerk(input).pipe(
            Effect.catchTags({
              ProductNotFound: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'BAD_REQUEST',
                    message: error.message
                  })
                ),
              PerkNotFound: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'BAD_REQUEST',
                    message: error.message
                  })
                )
            })
          );
        })
      )
    );

    if (Either.isLeft(res)) {
      throw res.left;
    }

    return res.right;
  }
);
export const createProductPerkAction = actionClient
  .inputSchema(Schema.standardSchemaV1(createProductPerkInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_createProductPerkAction)(parsedInput)
  );

const _deleteProductPerkAction = Effect.fn('deleteProductPerkAction')(
  function* (input: { productId: string; perkId: string }) {
    const res = yield* Effect.either(
      authenticateWithSession(yield* headers)(
        Effect.gen(function* () {
          const productService = yield* ProductService;
          return yield* productService.deleteProductPerk(input).pipe(
            Effect.catchTags({
              ProductNotFound: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'BAD_REQUEST',
                    message: error.message
                  })
                )
            })
          );
        })
      )
    );

    if (Either.isLeft(res)) {
      throw res.left;
    }

    return res.right;
  }
);
export const deleteProductPerkAction = actionClient
  .inputSchema(Schema.standardSchemaV1(deleteProductPerkInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_deleteProductPerkAction)(parsedInput)
  );

// Payment provider products
const _createPaymentProviderProductAction = Effect.fn(
  'createPaymentProviderProductAction'
)(function* (input: {
  productId: string;
  paymentProviderConfigurationId: string;
  configuration: Record<string, unknown>;
}) {
  const res = yield* Effect.either(
    authenticateWithSession(yield* headers)(
      Effect.gen(function* () {
        const productService = yield* PaymentProviderProductService;
        const paymentProviderProduct = yield* productService
          .createPaymentProviderProduct(input)
          .pipe(
            Effect.catchTags({
              ProductNotFound: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'BAD_REQUEST',
                    message: error.message
                  })
                ),
              PaymentProviderConfigurationNotFound: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'BAD_REQUEST',
                    message: error.message
                  })
                ),
              PaymentProviderNotFoundError: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'BAD_REQUEST',
                    message: error.message
                  })
                ),
              ParseError: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'BAD_REQUEST',
                    message: error.message
                  })
                ),
              ActionForbiddenError: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'FORBIDDEN',
                    message: error.message
                  })
                ),
              DatabaseError: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error.message
                  })
                )
            })
          );

        return paymentProviderProduct;
      })
    )
  );

  if (Either.isLeft(res)) {
    throw res.left;
  }

  return res.right;
});
export const createPaymentProviderProductAction = actionClient
  .inputSchema(Schema.standardSchemaV1(createPaymentProviderProductInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_createPaymentProviderProductAction)(parsedInput)
  );

const _updatePaymentProviderProductAction = Effect.fn(
  'updatePaymentProviderProductAction'
)(function* (input: {
  paymentProviderConfigurationProductId: string;
  configuration: Record<string, unknown>;
}) {
  const res = yield* Effect.either(
    authenticateWithSession(yield* headers)(
      Effect.gen(function* () {
        const productService = yield* PaymentProviderProductService;
        return yield* productService.updatePaymentProviderProduct(input).pipe(
          Effect.catchTags({
            ProductNotFound: (error) =>
              Effect.fail(
                new NextjsErrorResponse({
                  code: 'BAD_REQUEST',
                  message: error.message
                })
              ),
            PaymentProviderConfigurationNotFound: (error) =>
              Effect.fail(
                new NextjsErrorResponse({
                  code: 'BAD_REQUEST',
                  message: error.message
                })
              ),
            PaymentProviderNotFoundError: (error) =>
              Effect.fail(
                new NextjsErrorResponse({
                  code: 'BAD_REQUEST',
                  message: error.message
                })
              ),
            ProviderProductNotFound: (error) =>
              Effect.fail(
                new NextjsErrorResponse({
                  code: 'BAD_REQUEST',
                  message: error.message
                })
              ),
            ParseError: (error) =>
              Effect.fail(
                new NextjsErrorResponse({
                  code: 'BAD_REQUEST',
                  message: error.message
                })
              )
          })
        );
      })
    )
  );

  if (Either.isLeft(res)) {
    throw res.left;
  }

  return res.right;
});
export const updatePaymentProviderProductAction = actionClient
  .inputSchema(Schema.standardSchemaV1(updatePaymentProviderProductInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_updatePaymentProviderProductAction)(parsedInput)
  );

const _setActivePaymentProviderProductAction = Effect.fn(
  'setActivePaymentProviderProductAction'
)(function* (input: {
  productId: string;
  providerProductKey: string;
  paymentProviderConfigurationId: string;
}) {
  const res = yield* Effect.either(
    authenticateWithSession(yield* headers)(
      Effect.gen(function* () {
        const productService = yield* PaymentProviderProductService;
        return yield* productService
          .setActivePaymentProviderProduct(input)
          .pipe(
            Effect.catchTags({
              ProductNotFound: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'BAD_REQUEST',
                    message: error.message
                  })
                ),
              PaymentProviderConfigurationNotFound: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'BAD_REQUEST',
                    message: error.message
                  })
                ),
              PaymentProviderNotFoundError: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'BAD_REQUEST',
                    message: error.message
                  })
                )
            })
          );
      })
    )
  );

  if (Either.isLeft(res)) {
    throw res.left;
  }

  return res.right;
});
export const setActivePaymentProviderProductAction = actionClient
  .inputSchema(
    Schema.standardSchemaV1(setActivePaymentProviderProductInputSchema)
  )
  .action(async ({ parsedInput }) =>
    ServerAction.build(_setActivePaymentProviderProductAction)(parsedInput)
  );

const _deletePaymentProviderProductAction = Effect.fn(
  'deletePaymentProviderProductAction'
)(function* (input: {
  productId: string;
  paymentProviderConfigurationId: string;
  providerProductKey: string;
}) {
  const res = yield* Effect.either(
    authenticateWithSession(yield* headers)(
      Effect.gen(function* () {
        const productService = yield* PaymentProviderProductService;
        return yield* productService.deletePaymentProviderProduct(input).pipe(
          Effect.catchTags({
            ProductNotFound: (error) =>
              Effect.fail(
                new NextjsErrorResponse({
                  code: 'BAD_REQUEST',
                  message: error.message
                })
              )
          })
        );
      })
    )
  );

  if (Either.isLeft(res)) {
    throw res.left;
  }

  return res.right;
});
export const deletePaymentProviderProductAction = actionClient
  .inputSchema(Schema.standardSchemaV1(deletePaymentProviderProductInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_deletePaymentProviderProductAction)(parsedInput)
  );

// Customers
const _createCustomerAction = Effect.fn('createCustomerAction')(
  function* (input: {
    projectId: string;
    appUserId: string;
    name?: string | null;
    email?: string | null;
  }) {
    const res = yield* Effect.either(
      authenticateWithSession(yield* headers)(
        withEnvironmentFromCookie({ projectId: input.projectId })(
          Effect.gen(function* () {
            const customerService = yield* CustomerService;
            return yield* customerService
              .createCustomer({
                ...input,
                origin: CustomerOrigin.Dashboard,
                environment: yield* Environment
              })
              .pipe(
                Effect.catchTags({
                  InvalidAnonymousIdError: (error) =>
                    Effect.fail(
                      new NextjsErrorResponse({
                        code: 'BAD_REQUEST',
                        message: error.message
                      })
                    )
                })
              );
          })
        )
      )
    );

    if (Either.isLeft(res)) {
      throw res.left;
    }

    return res.right;
  }
);
export const createCustomerAction = actionClient
  .inputSchema(
    Schema.standardSchemaV1(createCustomerInputSchema.omit('origin'))
  )
  .action(async ({ parsedInput }) =>
    ServerAction.build(_createCustomerAction)(parsedInput)
  );

// Paywalls
const _createPaywallAction = Effect.fn('createPaywallAction')(
  function* (input: { projectId: string; name: string }) {
    const res = yield* Effect.either(
      authenticateWithSession(yield* headers)(
        withEnvironmentFromCookie({ projectId: input.projectId })(
          Effect.gen(function* () {
            const paywallService = yield* PaywallService;
            return yield* paywallService.createPaywall(input);
          })
        )
      )
    );

    if (Either.isLeft(res)) {
      throw res.left;
    }

    return res.right;
  }
);
export const createPaywallAction = actionClient
  .inputSchema(Schema.standardSchemaV1(createPaywallInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_createPaywallAction)(parsedInput)
  );

const _updatePaywallAction = Effect.fn('updatePaywallAction')(
  function* (input: {
    paywallId: string;
    name?: string | null;
    paywallProducts: ReadonlyArray<{
      productId: string;
      displayName: string;
      enableNativePurchase: boolean;
      enableWebCheckout: boolean;
      webCheckoutPaymentProviderConfigurationProductId: string | null;
      order: number;
    }>;
  }) {
    const res = yield* Effect.either(
      authenticateWithSession(yield* headers)(
        Effect.gen(function* () {
          const paywallService = yield* PaywallService;
          return yield* paywallService
            .updatePaywall({
              ...input,
              paywallProducts: [...input.paywallProducts]
            })
            .pipe(
              Effect.catchTags({
                PaywallNotFoundError: (error) =>
                  Effect.fail(
                    new NextjsErrorResponse({
                      code: 'NOT_FOUND',
                      message: error.message
                    })
                  ),
                ProductNotFound: (error) =>
                  Effect.fail(
                    new NextjsErrorResponse({
                      code: 'BAD_REQUEST',
                      message: error.message
                    })
                  ),
                PaymentProviderConfigurationNotFound: (error) =>
                  Effect.fail(
                    new NextjsErrorResponse({
                      code: 'BAD_REQUEST',
                      message: error.message
                    })
                  )
              })
            );
        })
      )
    );

    if (Either.isLeft(res)) {
      throw res.left;
    }

    return res.right;
  }
);
export const updatePaywallAction = actionClient
  .inputSchema(Schema.standardSchemaV1(updatePaywallInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_updatePaywallAction)(parsedInput)
  );

const _deletePaywallAction = Effect.fn('deletePaywallAction')(
  function* (input: { paywallId: string }) {
    const res = yield* Effect.either(
      authenticateWithSession(yield* headers)(
        Effect.gen(function* () {
          const paywallService = yield* PaywallService;
          return yield* paywallService.deletePaywall(input).pipe(
            Effect.catchTags({
              PaywallNotFoundError: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'NOT_FOUND',
                    message: error.message
                  })
                ),
              PaywallInUseError: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'BAD_REQUEST',
                    message: error.message
                  })
                )
            })
          );
        })
      )
    );

    if (Either.isLeft(res)) {
      throw res.left;
    }

    return res.right;
  }
);
export const deletePaywallAction = actionClient
  .inputSchema(Schema.standardSchemaV1(deletePaywallInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_deletePaywallAction)(parsedInput)
  );

// Paywall locations
const _createPaywallLocationAction = Effect.fn('createPaywallLocationAction')(
  function* (input: {
    projectId: string;
    name: string;
    slug: string;
    defaultPaywallId: string;
  }) {
    const res = yield* Effect.either(
      authenticateWithSession(yield* headers)(
        withEnvironmentFromCookie({ projectId: input.projectId })(
          Effect.gen(function* () {
            const paywallLocationService = yield* PaywallLocationService;
            return yield* paywallLocationService
              .createPaywallLocation(input)
              .pipe(
                Effect.catchTags({
                  SlugAlreadyExistsError: (error) =>
                    Effect.fail(
                      new NextjsErrorResponse({
                        code: 'BAD_REQUEST',
                        message: error.message
                      })
                    ),
                  DefaultPaywallNotFoundError: (error) =>
                    Effect.fail(
                      new NextjsErrorResponse({
                        code: 'NOT_FOUND',
                        message: error.message
                      })
                    )
                })
              );
          })
        )
      )
    );

    if (Either.isLeft(res)) {
      throw res.left;
    }

    return res.right;
  }
);
export const createPaywallLocationAction = actionClient
  .inputSchema(Schema.standardSchemaV1(createPaywallLocationInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_createPaywallLocationAction)(parsedInput)
  );

const _deletePaywallLocationAction = Effect.fn('deletePaywallLocationAction')(
  function* (input: { paywallLocationId: string }) {
    const res = yield* Effect.either(
      authenticateWithSession(yield* headers)(
        Effect.gen(function* () {
          const paywallLocationService = yield* PaywallLocationService;
          return yield* paywallLocationService
            .deletePaywallLocation({
              paywallLocationId: input.paywallLocationId
            })
            .pipe(
              Effect.catchTags({
                PaywallLocationNotFound: (error) =>
                  Effect.fail(
                    new NextjsErrorResponse({
                      code: 'NOT_FOUND',
                      message: error.message
                    })
                  )
              })
            );
        })
      )
    );

    if (Either.isLeft(res)) {
      throw res.left;
    }

    return res.right;
  }
);
export const deletePaywallLocationAction = actionClient
  .inputSchema(Schema.standardSchemaV1(deletePaywallLocationInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_deletePaywallLocationAction)(parsedInput)
  );
// Perks
const _createPerkAction = Effect.fn('createPerkAction')(function* (input: {
  projectId: string;
  name: string;
  slug: string;
}) {
  const res = yield* Effect.either(
    authenticateWithSession(yield* headers)(
      withEnvironmentFromCookie({ projectId: input.projectId })(
        Effect.gen(function* () {
          const perkService = yield* PerkService;
          return yield* perkService.createPerk(input).pipe(
            Effect.catchTags({
              SlugAlreadyExistsError: (error) =>
                Effect.fail(
                  new NextjsErrorResponse({
                    code: 'BAD_REQUEST',
                    message: error.message
                  })
                )
            })
          );
        })
      )
    )
  );

  if (Either.isLeft(res)) {
    throw res.left;
  }

  return res.right;
});
export const createPerkAction = actionClient
  .inputSchema(Schema.standardSchemaV1(createPerkInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_createPerkAction)(parsedInput)
  );

const _deletePerkAction = Effect.fn('deletePerkAction')(function* (input: {
  perkId: string;
}) {
  const res = yield* Effect.either(
    authenticateWithSession(yield* headers)(
      Effect.gen(function* () {
        const perkService = yield* PerkService;
        return yield* perkService.deletePerk({ perkId: input.perkId }).pipe(
          Effect.catchTags({
            PerkNotFound: (error) =>
              Effect.fail(
                new NextjsErrorResponse({
                  code: 'NOT_FOUND',
                  message: error.message
                })
              )
          })
        );
      })
    )
  );

  if (Either.isLeft(res)) {
    throw res.left;
  }

  return res.right;
});
export const deletePerkAction = actionClient
  .inputSchema(Schema.standardSchemaV1(deletePerkInputSchema))
  .action(async ({ parsedInput }) =>
    ServerAction.build(_deletePerkAction)(parsedInput)
  );
