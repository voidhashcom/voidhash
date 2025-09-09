import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  HttpApiSchema
} from '@effect/platform';
import { Schema } from 'effect';
import {
  Customer,
  GetSessionHeaders,
  SdkHeaders,
  SdkIdentifyBody,
  SdkSyncCustomerAttributesBody,
  Session
} from './schema';

const AppUserIdParam = HttpApiSchema.param('appUserId', Schema.String);

export const VoidhashApi = HttpApi.make('VoidhashApi')
  .add(
    HttpApiGroup.make('v1_auth')
      .add(
        HttpApiEndpoint.get('session')`/session`
          .addSuccess(Session)
          .setHeaders(GetSessionHeaders)
          .addError(HttpApiError.InternalServerError)
          .addError(HttpApiError.Unauthorized)
      )
      .prefix('/v1/auth')
  )
  .add(
    HttpApiGroup.make('v1_customers')
      .add(
        HttpApiEndpoint.get('byAppUserId')`/by-app-user-id/${AppUserIdParam}`
          .addSuccess(Customer)
          .addError(HttpApiError.Unauthorized)
          .addError(HttpApiError.InternalServerError)
          .addError(HttpApiError.Forbidden)
          .addError(HttpApiError.NotFound)
      )
      .prefix('/v1/customers')
  )
  .add(
    HttpApiGroup.make('v1_sdk')
      .add(
        HttpApiEndpoint.get('getCustomer')`/get-customer`
          .addSuccess(Customer)
          .setHeaders(SdkHeaders)
          .addError(HttpApiError.Unauthorized)
          .addError(HttpApiError.BadRequest)
          .addError(HttpApiError.Forbidden)
          .addError(HttpApiError.InternalServerError)
          .addError(HttpApiError.NotFound)
      )
      .add(
        HttpApiEndpoint.post('identify')`/identify`
          .setPayload(SdkIdentifyBody)
          .addSuccess(Customer)
          .setHeaders(SdkHeaders)
          .addError(HttpApiError.Unauthorized)
          .addError(HttpApiError.BadRequest)
          .addError(HttpApiError.Forbidden)
          .addError(HttpApiError.InternalServerError)
          .addError(HttpApiError.Conflict)
      )
      .add(
        HttpApiEndpoint.post(
          'syncCustomerAttributes'
        )`/sync-customer-attributes`
          .setPayload(SdkSyncCustomerAttributesBody)
          .addSuccess(Customer)
          .setHeaders(SdkHeaders)
          .addError(HttpApiError.Unauthorized)
          .addError(HttpApiError.BadRequest)
          .addError(HttpApiError.Forbidden)
          .addError(HttpApiError.InternalServerError)
      )
      .prefix('/v1/sdk')
  )
  .prefix('/api');
