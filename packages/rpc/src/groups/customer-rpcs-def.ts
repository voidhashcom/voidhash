import { Rpc, RpcGroup } from '@effect/rpc';
import {
  ActionForbiddenError,
  CustomerInvalidAnonymousIdError,
  CustomerNotFoundError,
  CustomerServiceError
} from '@voidhash/shared';
import { Schema } from 'effect';
import { AuthMiddleware } from '../middlewares';

export const Customer = Schema.Struct({
  id: Schema.String,
  name: Schema.NullOr(Schema.String),
  email: Schema.NullOr(Schema.String),
  appUserId: Schema.String,
  type: Schema.Number,
  createdAt: Schema.NullOr(Schema.Date)
});

export class CustomerRpcsDef extends RpcGroup.make(
  Rpc.make('CreateCustomer', {
    success: Customer,
    payload: {
      projectId: Schema.String,
      appUserId: Schema.String,
      name: Schema.optional(Schema.String),
      email: Schema.optional(Schema.String)
    },
    error: Schema.Union(
      ActionForbiddenError,
      CustomerInvalidAnonymousIdError,
      CustomerServiceError
    )
  }),
  Rpc.make('ListCustomers', {
    success: Schema.Array(Customer),
    payload: {
      projectId: Schema.String
    },
    error: Schema.Union(ActionForbiddenError, CustomerServiceError)
  }),
  Rpc.make('GetCustomerById', {
    success: Customer,
    payload: {
      customerId: Schema.String
    },
    error: Schema.Union(
      ActionForbiddenError,
      CustomerNotFoundError,
      CustomerServiceError
    )
  }),
  Rpc.make('GetCustomerByAppUserId', {
    success: Customer,
    payload: {
      projectId: Schema.String,
      appUserId: Schema.String
    },
    error: Schema.Union(
      ActionForbiddenError,
      CustomerNotFoundError,
      CustomerServiceError
    )
  })
).middleware(AuthMiddleware) {}
