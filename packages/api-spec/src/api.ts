import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import {
  ApiKeyNotFoundError,
  ApiKeyServiceError,
  AuthenticationError,
  CustomerInvalidAnonymousIdError,
  CustomerNotFoundError,
  CustomerServiceError,
  OrganizationServiceError,
  PerkServiceError,
  ProductPerkServiceError,
  ProductPerkValidationError,
  ProductServiceError,
  ProjectServiceError,
  SdkCustomerAlreadyIdentifiedError,
  SdkCustomerNotFoundError,
  SdkServiceError,
  SdkValidationError,
  UserServiceError,
} from "@voidhash/shared";
import { ActionForbiddenError } from "@voidhash/shared/errors";
import { Schema } from "effect";

import { AuthMiddleware } from "./middlewares";
import {
  ApiKey,
  ApiKeyIdParam,
  ApiKeyWithRawKey,
  AppUserIdParam,
  CreateCustomerBody,
  CreateOrganizationBody,
  CreateProjectBody,
  CreateSecretKeyBody,
  Customer,
  CustomerIdParam,
  Organization,
  OrganizationIdParam,
  Perk,
  Product,
  ProductIdParam,
  ProductPerk,
  Project,
  SdkCustomer,
  SdkHeaders,
  SdkIdentifyBody,
  SdkSyncCustomerAttributesBody,
  Session,
  User,
} from "./schema";

export const VoidhashV1Api = HttpApi.make("VoidhashV1Api")
  .add(
    HttpApiGroup.make("auth")
      .add(
        HttpApiEndpoint.get("session")`/session`
          .addSuccess(Session)
          .addError(ActionForbiddenError, { status: 403 })
          .middleware(AuthMiddleware)
      )
      .prefix("/auth")
  )
  .add(
    HttpApiGroup.make("api_keys")
      .add(
        HttpApiEndpoint.post("createSecretKey")`/`
          .addSuccess(ApiKeyWithRawKey)
          .setPayload(CreateSecretKeyBody)
          .addError(ApiKeyServiceError, { status: 500 })
          .addError(ActionForbiddenError, { status: 403 })
      )
      .add(
        HttpApiEndpoint.get("listApiKeys")`/`
          .addSuccess(Schema.Array(ApiKey))
          .addError(ApiKeyServiceError, { status: 500 })
          .addError(ActionForbiddenError, { status: 403 })
      )
      .add(
        HttpApiEndpoint.get("getApiKeyById")`/${ApiKeyIdParam}`
          .addSuccess(ApiKey)
          .addError(ApiKeyServiceError, { status: 500 })
          .addError(ApiKeyNotFoundError, { status: 404 })
          .addError(ActionForbiddenError, { status: 403 })
      )
      .add(
        HttpApiEndpoint.post("rotateSecretKey")`/${ApiKeyIdParam}/rotate`
          .addSuccess(ApiKeyWithRawKey)
          .addError(ApiKeyServiceError, { status: 500 })
          .addError(ApiKeyNotFoundError, { status: 404 })
          .addError(ActionForbiddenError, { status: 403 })
      )
      .add(
        HttpApiEndpoint.del("deleteApiKey")`/${ApiKeyIdParam}`
          .addError(ApiKeyServiceError, { status: 500 })
          .addError(ApiKeyNotFoundError, { status: 404 })
          .addError(ActionForbiddenError, { status: 403 })
      )
      .middleware(AuthMiddleware)
      .prefix("/api-keys")
  )
  .add(
    HttpApiGroup.make("customers")
      .add(
        HttpApiEndpoint.post("createCustomer")`/`
          .setPayload(CreateCustomerBody)
          .addSuccess(Customer)
          .addError(ActionForbiddenError, { status: 403 })
          .addError(CustomerInvalidAnonymousIdError, { status: 400 })
          .addError(CustomerServiceError, { status: 500 })
      )
      .add(
        HttpApiEndpoint.get("listCustomers")`/`
          .addSuccess(Schema.Array(Customer))
          .addError(ActionForbiddenError, { status: 403 })
          .addError(CustomerServiceError, { status: 500 })
      )
      .add(
        HttpApiEndpoint.get("getCustomerById")`/${CustomerIdParam}`
          .addSuccess(Customer)
          .addError(ActionForbiddenError, { status: 403 })
          .addError(CustomerNotFoundError, { status: 404 })
          .addError(CustomerServiceError, { status: 500 })
      )
      .add(
        HttpApiEndpoint.get("byAppUserId")`/by-app-user-id/${AppUserIdParam}`
          .addSuccess(Customer)
          .addError(ActionForbiddenError, { status: 403 })
          .addError(CustomerNotFoundError, { status: 404 })
          .addError(CustomerServiceError, { status: 500 })
      )
      .middleware(AuthMiddleware)
      .prefix("/customers")
  )
  .add(
    HttpApiGroup.make("organizations")
      .add(
        HttpApiEndpoint.post("createOrganization")`/`
          .setPayload(CreateOrganizationBody)
          .addSuccess(Organization)
          .addError(OrganizationServiceError, { status: 500 })
      )
      .middleware(AuthMiddleware)
      .prefix("/organizations")
  )
  .add(
    HttpApiGroup.make("perks")
      .add(
        HttpApiEndpoint.get("listPerks")`/`
          .addSuccess(Schema.Array(Perk))

          .addError(ActionForbiddenError, { status: 403 })
          .addError(PerkServiceError, { status: 500 })
      )
      .middleware(AuthMiddleware)
      .prefix("/perks")
  )
  .add(
    HttpApiGroup.make("projects")

      .add(
        HttpApiEndpoint.post("createProject")`/`
          .setPayload(CreateProjectBody)
          .addSuccess(Project)

          .addError(ActionForbiddenError, { status: 403 })
          .addError(AuthenticationError, { status: 401 })
          .addError(ProjectServiceError, { status: 500 })
      )
      .add(
        HttpApiEndpoint.get("listProjects")`/${OrganizationIdParam}`
          .addSuccess(Schema.Array(Project))

          .addError(ActionForbiddenError, { status: 403 })
          .addError(ProjectServiceError, { status: 500 })
      )
      .middleware(AuthMiddleware)
      .prefix("/projects")
  )
  .add(
    HttpApiGroup.make("products")
      .add(
        HttpApiEndpoint.get("listProducts")`/`
          .addSuccess(Schema.Array(Product))

          .addError(ActionForbiddenError, { status: 403 })
          .addError(ProductServiceError, { status: 500 })
      )
      .middleware(AuthMiddleware)
      .prefix("/products")
  )
  .add(
    HttpApiGroup.make("product_perks")
      .add(
        HttpApiEndpoint.get(
          "listProductPerksByProductId"
        )`/by-product-id/${ProductIdParam}`
          .addSuccess(Schema.Array(ProductPerk))

          .addError(ActionForbiddenError, { status: 403 })
          .addError(ProductPerkServiceError, { status: 500 })
          .addError(ProductPerkValidationError, { status: 400 })
      )
      .middleware(AuthMiddleware)
      .prefix("/product-perks")
  )
  .add(
    HttpApiGroup.make("sdk")
      .add(
        HttpApiEndpoint.get("getCustomer")`/get-customer`
          .addSuccess(SdkCustomer)
          .setHeaders(SdkHeaders)
          .addError(AuthenticationError, { status: 401 })
          .addError(SdkServiceError, { status: 500 })
          .addError(SdkCustomerNotFoundError, { status: 404 })
          .addError(SdkValidationError, { status: 400 })
      )
      .add(
        HttpApiEndpoint.post("identify")`/identify`
          .setPayload(SdkIdentifyBody)
          .addSuccess(SdkCustomer)
          .setHeaders(SdkHeaders)
          .addError(AuthenticationError, { status: 401 })
          .addError(SdkServiceError, { status: 500 })
          .addError(SdkValidationError, { status: 400 })
          .addError(SdkCustomerAlreadyIdentifiedError, { status: 409 })
      )
      .add(
        HttpApiEndpoint.post(
          "syncCustomerAttributes"
        )`/sync-customer-attributes`
          .setPayload(SdkSyncCustomerAttributesBody)
          .addSuccess(SdkCustomer)
          .setHeaders(SdkHeaders)
          .addError(AuthenticationError, { status: 401 })
          .addError(SdkServiceError, { status: 500 })
          .addError(SdkValidationError, { status: 400 })
      )
      .middleware(AuthMiddleware)
      .prefix("/sdk")
  )
  .add(
    HttpApiGroup.make("users")
      .add(
        HttpApiEndpoint.get("getUser")`/current`
          .addSuccess(User)
          .addError(AuthenticationError, { status: 401 })
          .addError(UserServiceError, { status: 500 })
      )
      .middleware(AuthMiddleware)
      .prefix("/users")
  )

  .prefix("/api/v1");
