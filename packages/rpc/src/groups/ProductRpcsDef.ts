import { Rpc, RpcGroup } from "effect/unstable/rpc";
import * as Schema from "effect/Schema";

import { RpcActionForbiddenError } from "../errors/common.ts";
import {
  RpcProductNotFoundError,
  RpcProductServiceError,
  RpcProductSlugAlreadyExistsError,
  RpcProductValidationError,
} from "../errors/product.ts";
import { AuthMiddleware } from "../middlewares.ts";

export const ProductType = Schema.Union([
  Schema.Literal("subscription"),
  Schema.Literal("one-time"),
  Schema.Literal("one-time-consumable"),
]);
export type ProductType = typeof ProductType.Type;

export const Product = Schema.Struct({
  duration: Schema.NullOr(Schema.Number),
  id: Schema.String,
  name: Schema.String,
  projectId: Schema.String,
  slug: Schema.String,
  type: ProductType,
});
export type Product = typeof Product.Type;

export class ProductRpcsDef extends RpcGroup.make(
  Rpc.make("ListProducts", {
    error: Schema.Union([RpcActionForbiddenError, RpcProductServiceError]),
    payload: Schema.Struct({
      projectId: Schema.String,
    }),
    success: Schema.Array(Product),
  }),
  Rpc.make("GetProduct", {
    error: Schema.Union([RpcActionForbiddenError, RpcProductServiceError, RpcProductNotFoundError]),
    payload: Schema.Struct({
      id: Schema.String,
    }),
    success: Product,
  }),
  Rpc.make("CreateProduct", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcProductServiceError,
      RpcProductSlugAlreadyExistsError,
      RpcProductValidationError,
    ]),
    payload: Schema.Struct({
      name: Schema.String,
      projectId: Schema.String,
      slug: Schema.String,
      type: Schema.Number,
      duration: Schema.optional(Schema.Number),
    }),
    success: Schema.Struct({
      id: Schema.String,
    }),
  }),
  Rpc.make("UpdateProduct", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcProductServiceError,
      RpcProductNotFoundError,
      RpcProductSlugAlreadyExistsError,
    ]),
    payload: Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      slug: Schema.optional(Schema.String),
    }),
    success: Schema.Void,
  }),
  Rpc.make("DeleteProduct", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcProductServiceError,
      RpcProductNotFoundError,
      RpcProductValidationError,
    ]),
    payload: Schema.Struct({
      id: Schema.String,
    }),
    success: Schema.Void,
  }),
).middleware(AuthMiddleware) {}
