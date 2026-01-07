import { Rpc, RpcGroup } from "@effect/rpc";
import {
  ActionForbiddenError,
  ProductPerkServiceError,
  ProductPerkValidationError,
} from "@voidhash/shared";
import { Schema } from "effect";

import { AuthMiddleware } from "../middlewares";

export const ProductPerk = Schema.Struct({
  id: Schema.String,
  perkId: Schema.String,
  productId: Schema.String,
});

export class ProductPerkRpcsDef extends RpcGroup.make(
  Rpc.make("ListProductPerksByProductId", {
    error: Schema.Union(
      ActionForbiddenError,
      ProductPerkServiceError,
      ProductPerkValidationError
    ),
    payload: {
      productId: Schema.String,
    },
    success: Schema.Array(ProductPerk),
  }),
  Rpc.make("CreateProductPerk", {
    error: Schema.Union(
      ActionForbiddenError,
      ProductPerkServiceError,
      ProductPerkValidationError
    ),
    payload: Schema.Struct({
      perkId: Schema.String,
      productId: Schema.String,
    }),
    success: Schema.Void,
  }),
  Rpc.make("DeleteProductPerk", {
    error: Schema.Union(
      ActionForbiddenError,
      ProductPerkServiceError,
      ProductPerkValidationError
    ),
    payload: Schema.Struct({
      id: Schema.String,
    }),
    success: Schema.Void,
  })
).middleware(AuthMiddleware) {}
