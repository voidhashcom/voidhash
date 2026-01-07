import { Effect } from 'effect';
import { createProductPerk } from './create-product-perk';
import { deleteProductPerk } from './delete-product-perk';
import { getProductPerksByProductId } from './get-product-perks-by-product-id';

export class ProductPerkService extends Effect.Service<ProductPerkService>()(
  'ProductService',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      return {
        createProductPerk: yield* createProductPerk,
        getProductPerksByProductId: yield* getProductPerksByProductId,
        deleteProductPerk: yield* deleteProductPerk
      } as const;
    })
  }
) {}
