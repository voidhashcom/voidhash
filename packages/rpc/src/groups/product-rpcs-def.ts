import { Rpc, RpcGroup } from '@effect/rpc';
import { ActionForbiddenError, ProductServiceError } from '@voidhash/shared';
import { Schema } from 'effect';
import { AuthMiddleware } from '../middlewares';

export const ProductType = Schema.Literal(
  'subscription',
  'one-time',
  'one-time-consumable'
);

export class Product extends Schema.Class<Product>('Product')({
  id: Schema.String,
  type: ProductType,
  name: Schema.String,
  projectId: Schema.String
}) {}

export class ProductRpcsDef extends RpcGroup.make(
  Rpc.make('ListProducts', {
    success: Schema.Array(Product),
    error: Schema.Union(ActionForbiddenError, ProductServiceError)
  })
).middleware(AuthMiddleware) {}
