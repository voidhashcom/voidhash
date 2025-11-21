import { Rpc, RpcGroup } from '@effect/rpc';
import {
  ActionForbiddenError,
  ProductPerkServiceError,
  ProductPerkValidationError
} from '@voidhash/shared';
import { Schema } from 'effect';
import { AuthMiddleware } from '../middlewares';

export const ProductPerk = Schema.Struct({
  id: Schema.String,
  productId: Schema.String,
  perkId: Schema.String
});

export class ProductPerkRpcsDef extends RpcGroup.make(
  Rpc.make('ListProductPerksByProductId', {
    success: Schema.Array(ProductPerk),
    payload: {
      productId: Schema.String
    },
    error: Schema.Union(
      ActionForbiddenError,
      ProductPerkServiceError,
      ProductPerkValidationError
    )
  }),
  Rpc.make('CreateProductPerk', {
    payload: Schema.Struct({
      productId: Schema.String,
      perkId: Schema.String
    }),
    success: Schema.Void,
    error: Schema.Union(
      ActionForbiddenError,
      ProductPerkServiceError,
      ProductPerkValidationError
    )
  }),
  Rpc.make('DeleteProductPerk', {
    payload: Schema.Struct({
      id: Schema.String
    }),
    success: Schema.Void,
    error: Schema.Union(
      ActionForbiddenError,
      ProductPerkServiceError,
      ProductPerkValidationError
    )
  })
).middleware(AuthMiddleware) {}
