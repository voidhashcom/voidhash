import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  HttpApiSchema
} from '@effect/platform';
import {
  ActionForbiddenError,
  CustomerConflictError,
  CustomerNotFoundError,
  FailedToCreateOrganizationError,
  InvalidAnonymousIdError,
  InvalidSecretKeyError,
  MissingProjectIdError,
  UnauthenticatedError,
  UserSessionNotFoundError
} from '@voidhash/shared/errors';
import { Schema } from 'effect';
import { InternalError } from './errors';
import {
  CreateOrganizationBody,
  CreateProjectBody,
  Customer,
  GetSessionHeaders,
  Organization,
  Project,
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
          .addError(HttpApiError.HttpApiDecodeError)
          .addError(InvalidSecretKeyError, { status: 401 })
          .addError(UnauthenticatedError, { status: 401 })
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
          .addError(ActionForbiddenError, { status: 403 })
          .addError(CustomerNotFoundError, { status: 404 })
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
          .addError(HttpApiError.InternalServerError)
          .addError(MissingProjectIdError, { status: 403 })
          .addError(CustomerNotFoundError, { status: 404 })
      )
      .add(
        HttpApiEndpoint.post('identify')`/identify`
          .setPayload(SdkIdentifyBody)
          .addSuccess(Customer)
          .setHeaders(SdkHeaders)
          .addError(HttpApiError.Unauthorized)
          .addError(HttpApiError.BadRequest)
          .addError(HttpApiError.InternalServerError)
          .addError(MissingProjectIdError, { status: 403 })
          .addError(CustomerConflictError, { status: 409 })
      )
      .add(
        HttpApiEndpoint.post(
          'syncCustomerAttributes'
        )`/sync-customer-attributes`
          .setPayload(SdkSyncCustomerAttributesBody)
          .addSuccess(Customer)
          .setHeaders(SdkHeaders)
          .addError(MissingProjectIdError, { status: 403 })
          .addError(InvalidAnonymousIdError, { status: 400 })
          .addError(HttpApiError.Unauthorized)
          .addError(HttpApiError.BadRequest)
          .addError(HttpApiError.InternalServerError)
      )
      .prefix('/v1/sdk')
  )
  .add(
    HttpApiGroup.make('v1_organizations')
      .add(
        HttpApiEndpoint.post('createOrganization')`/create`
          .setPayload(CreateOrganizationBody)
          .addSuccess(Organization)
          .setHeaders(GetSessionHeaders)
          .addError(HttpApiError.Unauthorized)
          .addError(HttpApiError.BadRequest)
          .addError(HttpApiError.InternalServerError)
          .addError(UnauthenticatedError, { status: 401 })
          .addError(FailedToCreateOrganizationError, { status: 500 })
          .addError(UserSessionNotFoundError, { status: 401 })
      )
      .prefix('/v1/organizations')
  )
  .add(
    HttpApiGroup.make('v1_projects').add(
      HttpApiEndpoint.post('createProject')`/create`
        .setPayload(CreateProjectBody)
        .addSuccess(Project)
        .setHeaders(GetSessionHeaders)
        .addError(HttpApiError.Unauthorized)
        .addError(HttpApiError.BadRequest)
        .addError(InternalError, { status: 500 })
        .addError(UnauthenticatedError, { status: 401 })
        .addError(ActionForbiddenError, { status: 403 })
        .prefix('/v1/projects')
    )
  )
  .prefix('/api');
