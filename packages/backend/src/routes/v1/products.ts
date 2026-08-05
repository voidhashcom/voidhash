import { Product, VoidhashV1Api } from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiProductServiceError,
} from "@voidhash/api-contracts/errors";
import { ProductService } from "@voidhash/core/services";
import { extractAuthorizedProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession } from "../../ApiMiddlewares.ts";

export const ProductsGroupLive = HttpApiBuilder.group(VoidhashV1Api, "products", (handlers) =>
  Effect.gen(function* () {
    const productService = yield* ProductService;

    return handlers.handle("listProducts", () =>
      bridgeAuthSession(
        Effect.gen(function* () {
          const authSession = yield* AuthSession;
          const projectId = yield* extractAuthorizedProjectId(authSession);
          const products = yield* productService.getProducts(projectId);
          return products.map((product) => new Product(product));
        }),
      ).pipe(
        Effect.catchTags({
          ActionForbiddenError: (e) =>
            Effect.fail(new ApiActionForbiddenError({ message: e.message })),
          ProductServiceError: (e) => Effect.fail(new ApiProductServiceError({ cause: e.cause })),
        }),
      ),
    );
  }),
);
