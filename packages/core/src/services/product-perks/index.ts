import { Effect } from "effect";

import { createProductPerk } from "./create-product-perk";
import { deleteProductPerk } from "./delete-product-perk";
import { getProductPerksByProductId } from "./get-product-perks-by-product-id";

export class ProductPerkService extends Effect.Service<ProductPerkService>()(
  "ProductPerkService",
  {
    dependencies: [],
    effect: Effect.gen(function* effect() {
      return {
        createProductPerk: yield* createProductPerk,
        deleteProductPerk: yield* deleteProductPerk,
        getProductPerksByProductId: yield* getProductPerksByProductId,
      } as const;
    }),
  }
) {}
