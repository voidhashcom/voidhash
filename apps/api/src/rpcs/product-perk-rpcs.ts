import { ProductPerkService } from '@voidhash/core/services';
import { ProductPerkRpcsDef } from '@voidhash/rpc';
import { Effect, Layer } from 'effect';

export const ProductPerkRpcsLive = ProductPerkRpcsDef.toLayer(
  Effect.gen(function* () {
    const productPerkService = yield* ProductPerkService;
    return {
      ListProductPerksByProductId: ({ productId }) =>
        productPerkService.getProductPerksByProductId(productId),
      CreateProductPerk: (input) => productPerkService.createProductPerk(input),
      DeleteProductPerk: (input) => productPerkService.deleteProductPerk(input)
    };
  })
).pipe(Layer.provide(ProductPerkService.Default));
