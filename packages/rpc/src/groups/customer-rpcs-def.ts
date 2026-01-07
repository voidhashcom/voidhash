import { Rpc, RpcGroup } from "@effect/rpc";
import {
  ActionForbiddenError,
  CustomerInvalidAnonymousIdError,
  CustomerNotFoundError,
  CustomerServiceError,
} from "@voidhash/shared";
import { Schema } from "effect";

import { AuthMiddleware } from "../middlewares";

export const Customer = Schema.Struct({
  appUserId: Schema.String,
  createdAt: Schema.NullOr(Schema.Date),
  email: Schema.NullOr(Schema.String),
  id: Schema.String,
  name: Schema.NullOr(Schema.String),
  type: Schema.Number,
});

export class CustomerRpcsDef extends RpcGroup.make(
  Rpc.make("CreateCustomer", {
    error: Schema.Union(
      ActionForbiddenError,
      CustomerInvalidAnonymousIdError,
      CustomerServiceError
    ),
    payload: {
      appUserId: Schema.String,
      email: Schema.optional(Schema.String),
      name: Schema.optional(Schema.String),
      projectId: Schema.String,
    },
    success: Customer,
  }),
  Rpc.make("ListCustomers", {
    error: Schema.Union(ActionForbiddenError, CustomerServiceError),
    payload: {
      projectId: Schema.String,
    },
    success: Schema.Array(Customer),
  }),
  Rpc.make("GetCustomerById", {
    error: Schema.Union(
      ActionForbiddenError,
      CustomerNotFoundError,
      CustomerServiceError
    ),
    payload: {
      customerId: Schema.String,
    },
    success: Customer,
  }),
  Rpc.make("GetCustomerByAppUserId", {
    error: Schema.Union(
      ActionForbiddenError,
      CustomerNotFoundError,
      CustomerServiceError
    ),
    payload: {
      appUserId: Schema.String,
      projectId: Schema.String,
    },
    success: Customer,
  })
).middleware(AuthMiddleware) {}
