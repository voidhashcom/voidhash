import { Effect } from "effect";

import { createProduct } from "./create-product";
import { deleteProduct } from "./delete-product";
import { getProductById } from "./get-product-by-id";
import { getProducts } from "./get-products";
import { updateProduct } from "./update-product";

export class ProductService extends Effect.Service<ProductService>()(
  "ProductService",
  {
    dependencies: [],
    effect: Effect.gen(function* effect() {
      return {
        // Core actions
        createProduct: yield* createProduct,
        deleteProduct: yield* deleteProduct,
        getProductById: yield* getProductById,
        getProducts: yield* getProducts,
        updateProduct: yield* updateProduct,
      };
    }),
  }
) {}
