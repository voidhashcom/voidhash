import { ProductPerk, VoidhashV1Api } from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiProductPerkServiceError,
  ApiProductPerkValidationError,
} from "@voidhash/api-contracts/errors";
import { ProductPerkService } from "@voidhash/core/services";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession } from "../../ApiMiddlewares.ts";

export const ProductPerksGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "product_perks",
  (handlers) =>
    Effect.gen(function* () {
      const productService = yield* ProductPerkService;

      return handlers.handle("listProductPerksByProductId", ({ params: { productId } }) =>
        bridgeAuthSession(
          productService.getProductPerksByProductId(productId).pipe(
            Effect.map((productPerks) =>
              productPerks.map(
                (productPerk) =>
                  new ProductPerk({
                    id: productPerk.id,
                    perkId: productPerk.perkId,
                    productId: productPerk.productId,
                  }),
              ),
            ),
          ),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            ProductPerkServiceError: (e) =>
              Effect.fail(new ApiProductPerkServiceError({ cause: e.cause })),
            ProductPerkValidationError: (e) =>
              Effect.fail(new ApiProductPerkValidationError({ message: e.message })),
          }),
        ),
      );
    }),
);
