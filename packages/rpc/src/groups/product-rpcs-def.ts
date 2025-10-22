import { Rpc, RpcGroup } from '@effect/rpc';
import {
  ActionForbiddenError,
  ProductNotFoundError,
  ProductServiceError
} from '@voidhash/shared';
import { Schema } from 'effect';
import { AuthMiddleware } from '../middlewares';

export const ProductType = Schema.Literal(
  'subscription',
  'one-time',
  'one-time-consumable'
);

export const Product = Schema.Struct({
  id: Schema.String,
  type: ProductType,
  name: Schema.String,
  projectId: Schema.String
});

export class ProductRpcsDef extends RpcGroup.make(
  Rpc.make('ListProducts', {
    payload: Schema.Struct({
      projectId: Schema.String
    }),
    success: Schema.Array(Product),
    error: Schema.Union(ActionForbiddenError, ProductServiceError)
  }),
  Rpc.make('GetProduct', {
    payload: Schema.Struct({
      productId: Schema.String
    }),
    success: Product,
    error: Schema.Union(
      ActionForbiddenError,
      ProductServiceError,
      ProductNotFoundError
    )
  }),
  Rpc.make('CreateProduct', {
    payload: Schema.Struct({
      projectId: Schema.String,
      name: Schema.String
    }),
    success: Schema.Struct({
      id: Schema.String
    }),
    error: Schema.Union(ActionForbiddenError, ProductServiceError)
  }),
  Rpc.make('UpdateProduct', {
    payload: Schema.Struct({
      productId: Schema.String,
      name: Schema.String
    }),
    success: Schema.Void,
    error: Schema.Union(
      ActionForbiddenError,
      ProductServiceError,
      ProductNotFoundError
    )
  }),
  Rpc.make('DeleteProduct', {
    payload: Schema.Struct({
      productId: Schema.String
    }),
    success: Schema.Void,
    error: Schema.Union(
      ActionForbiddenError,
      ProductServiceError,
      ProductNotFoundError
    )
  })
).middleware(AuthMiddleware) {}
