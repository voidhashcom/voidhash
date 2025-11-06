import { Effect } from 'effect';
import { createProduct } from './create-product';
import { deleteProduct } from './delete-product';
import { getProductById } from './get-product-by-id';
import { getProducts } from './get-products';
import { updateProduct } from './update-product';

export class ProductService extends Effect.Service<ProductService>()(
  'ProductService',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      return {
        // Core actions
        createProduct: yield* createProduct,
        updateProduct: yield* updateProduct,
        getProducts: yield* getProducts,
        getProductById: yield* getProductById,
        deleteProduct: yield* deleteProduct
      };
    })
  }
) {}

