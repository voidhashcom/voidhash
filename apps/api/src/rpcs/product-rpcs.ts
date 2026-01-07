import { ProductService } from "@voidhash/core/services";
import { ProductRpcsDef } from "@voidhash/rpc";
import { Effect, Layer } from "effect";

export const ProductRpcsLive = ProductRpcsDef.toLayer(
  Effect.gen(function* ProductRpcsLive() {
    const productService = yield* ProductService;
    return {
      CreateProduct: (input) => productService.createProduct(input),
      DeleteProduct: (input) => productService.deleteProduct(input),
      GetProduct: ({ id }) =>
        Effect.gen(function* GetProduct() {
          return yield* productService.getProductById(id);
        }),
      ListProducts: ({ projectId }) =>
        Effect.gen(function* ListProducts() {
          return yield* productService.getProducts(projectId);
        }),
      UpdateProduct: (input) => productService.updateProduct(input),
    };
  })
).pipe(Layer.provide(ProductService.Default));
