import { ProductPerkService } from '@voidhash/core/services';
import { ProductPerkRpcsDef } from '@voidhash/rpc';
import { Effect, Layer } from 'effect';

export const ProductPerkRpcsLive = ProductPerkRpcsDef.toLayer(
  Effect.gen(function* () {
    const productPerkService = yield* ProductPerkService;
    return {
      ListProductPerksByProductId: ({ productId }) =>
        productPerkService.getProductPerksByProductId(productId)
    };
  })
).pipe(Layer.provide(ProductPerkService.Default));
