import { Rpc, RpcGroup } from '@effect/rpc';
import {
  ActionForbiddenError,
  CustomerInvalidAnonymousIdError,
  CustomerNotFoundError,
  CustomerServiceError
} from '@voidhash/shared';
import { Schema } from 'effect';
import { AuthMiddleware } from '../middlewares';

export class Customer extends Schema.Class<Customer>('Customer')({
  id: Schema.String,
  name: Schema.NullOr(Schema.String),
  email: Schema.NullOr(Schema.String),
  appUserId: Schema.String
}) {}

export class CustomerRpcsDef extends RpcGroup.make(
  Rpc.make('CreateCustomer', {
    success: Customer,
    payload: {
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
      appUserId: Schema.String
    },
    error: Schema.Union(
      ActionForbiddenError,
      CustomerNotFoundError,
      CustomerServiceError
    )
  })
).middleware(AuthMiddleware) {}
