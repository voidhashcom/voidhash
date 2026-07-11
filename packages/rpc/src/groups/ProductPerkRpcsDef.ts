import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { Schema } from "effect";

import { RpcActionForbiddenError } from "../errors/common.ts";
import {
  RpcProductPerkServiceError,
  RpcProductPerkValidationError,
} from "../errors/ProductPerk.ts";
import { AuthMiddleware } from "../middlewares.ts";

export const ProductPerk = Schema.Struct({
  id: Schema.String,
  perkId: Schema.String,
  productId: Schema.String,
});

export class ProductPerkRpcsDef extends RpcGroup.make(
  Rpc.make("ListProductPerksByProductId", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcProductPerkServiceError,
      RpcProductPerkValidationError,
    ]),
    payload: {
      productId: Schema.String,
    },
    success: Schema.Array(ProductPerk),
  }),
  Rpc.make("CreateProductPerk", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcProductPerkServiceError,
      RpcProductPerkValidationError,
    ]),
    payload: Schema.Struct({
      perkId: Schema.String,
      productId: Schema.String,
    }),
    success: Schema.Void,
  }),
  Rpc.make("DeleteProductPerk", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcProductPerkServiceError,
      RpcProductPerkValidationError,
    ]),
    payload: Schema.Struct({
      id: Schema.String,
    }),
    success: Schema.Void,
  }),
).middleware(AuthMiddleware) {}
