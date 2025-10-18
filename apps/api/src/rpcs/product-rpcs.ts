import { ProductService } from '@voidhash/core/services';
import { extractAuthorizedProjectId } from '@voidhash/core/utils';
import { ProductRpcsDef } from '@voidhash/rpc';
import { AuthSession } from '@voidhash/shared';
import { Effect, Layer } from 'effect';

export const ProductRpcsLive = ProductRpcsDef.toLayer(
  Effect.gen(function* () {
    const productService = yield* ProductService;
    return {
      ListProducts: () =>
        Effect.gen(function* () {
          const authSession = yield* AuthSession;
          const projectId = yield* extractAuthorizedProjectId(authSession);
          return yield* productService.getProducts(projectId);
        })
    };
  })
).pipe(Layer.provide(ProductService.Default));
