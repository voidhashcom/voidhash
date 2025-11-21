import { ProductService } from '@voidhash/core/services';
import { ProductRpcsDef } from '@voidhash/rpc';
import { Effect, Layer } from 'effect';

export const ProductRpcsLive = ProductRpcsDef.toLayer(
  Effect.gen(function* () {
    const productService = yield* ProductService;
    return {
      ListProducts: ({ projectId }) =>
        Effect.gen(function* () {
          return yield* productService.getProducts(projectId);
        }),
      GetProduct: ({ id }) =>
        Effect.gen(function* () {
          return yield* productService.getProductById(id);
        }),
      CreateProduct: (input) => productService.createProduct(input),
      UpdateProduct: (input) => productService.updateProduct(input),
      DeleteProduct: (input) => productService.deleteProduct(input)
    };
  })
).pipe(Layer.provide(ProductService.Default));
