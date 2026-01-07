import { HttpApiBuilder } from "@effect/platform";
import { VoidhashV1Api } from "@voidhash/api-spec";
import { ProductService } from "@voidhash/core/services";
import { extractAuthorizedProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/shared";
import { Effect } from "effect";

export const ProductsGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "products",
  (handlers) =>
    Effect.gen(function* ProductsGroupLive() {
      const productService = yield* ProductService;

      return handlers.handle("listProducts", () =>
        Effect.gen(function* ProductsGroupLive() {
          const authSession = yield* AuthSession;
          const projectId = yield* extractAuthorizedProjectId(authSession);
          return yield* productService.getProducts(projectId);
        })
      );
    })
);
