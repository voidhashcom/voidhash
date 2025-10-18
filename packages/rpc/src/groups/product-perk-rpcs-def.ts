import { Rpc, RpcGroup } from '@effect/rpc';
import {
  ActionForbiddenError,
  ProductPerkServiceError,
  ProductPerkValidationError
} from '@voidhash/shared';
import { Schema } from 'effect';
import { AuthMiddleware } from '../middlewares';

export class ProductPerk extends Schema.Class<ProductPerk>('ProductPerk')({
  id: Schema.String,
  productId: Schema.String,
  perkId: Schema.String
}) {}

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
  })
).middleware(AuthMiddleware) {}
