import { HttpApiBuilder } from '@effect/platform';
import { VoidhashV1Api } from '@voidhash/api-spec';
import { ProductPerkService } from '@voidhash/core/services';
import { Effect } from 'effect';

export const ProductPerksGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  'product_perks',
  (handlers) =>
    Effect.gen(function* () {
      const productService = yield* ProductPerkService;

      return handlers.handle(
        'listProductPerksByProductId',
        ({ path: { productId } }) =>
          productService.getProductPerksByProductId(productId)
      );
    })
);
