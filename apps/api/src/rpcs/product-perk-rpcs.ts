import { ProductPerkService } from "@voidhash/core/services";
import { ProductPerkRpcsDef } from "@voidhash/rpc";
import { Effect, Layer } from "effect";

export const ProductPerkRpcsLive = ProductPerkRpcsDef.toLayer(
  Effect.gen(function* ProductPerkRpcsLive() {
    const productPerkService = yield* ProductPerkService;
    return {
      CreateProductPerk: (input) => productPerkService.createProductPerk(input),
      DeleteProductPerk: (input) => productPerkService.deleteProductPerk(input),
      ListProductPerksByProductId: ({ productId }) =>
        productPerkService.getProductPerksByProductId(productId),
    };
  })
).pipe(Layer.provide(ProductPerkService.Default));
