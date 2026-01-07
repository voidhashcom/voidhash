import { Rpc, RpcGroup } from "@effect/rpc";
import {
  ActionForbiddenError,
  ProductNotFoundError,
  ProductServiceError,
  ProductSlugAlreadyExistsError,
} from "@voidhash/shared";
import { Schema } from "effect";

import { AuthMiddleware } from "../middlewares";

export const ProductType = Schema.Literal(
  "subscription",
  "one-time",
  "one-time-consumable"
);

export const Product = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  projectId: Schema.String,
  type: ProductType,
});

export class ProductRpcsDef extends RpcGroup.make(
  Rpc.make("ListProducts", {
    error: Schema.Union(ActionForbiddenError, ProductServiceError),
    payload: Schema.Struct({
      projectId: Schema.String,
    }),
    success: Schema.Array(Product),
  }),
  Rpc.make("GetProduct", {
    error: Schema.Union(
      ActionForbiddenError,
      ProductServiceError,
      ProductNotFoundError
    ),
    payload: Schema.Struct({
      id: Schema.String,
    }),
    success: Product,
  }),
  Rpc.make("CreateProduct", {
    error: Schema.Union(
      ActionForbiddenError,
      ProductServiceError,
      ProductSlugAlreadyExistsError
    ),
    payload: Schema.Struct({
      name: Schema.String,
      projectId: Schema.String,
      slug: Schema.String,
    }),
    success: Schema.Struct({
      id: Schema.String,
    }),
  }),
  Rpc.make("UpdateProduct", {
    error: Schema.Union(
      ActionForbiddenError,
      ProductServiceError,
      ProductNotFoundError
    ),
    payload: Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      slug: Schema.optional(Schema.String),
    }),
    success: Schema.Void,
  }),
  Rpc.make("DeleteProduct", {
    error: Schema.Union(
      ActionForbiddenError,
      ProductServiceError,
      ProductNotFoundError
    ),
    payload: Schema.Struct({
      id: Schema.String,
    }),
    success: Schema.Void,
  })
).middleware(AuthMiddleware) {}
