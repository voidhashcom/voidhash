import { OrganizationService } from "@voidhash/core/services";
import {
  OrganizationRpcsDef,
  RpcActionForbiddenError,
  RpcAvatarValidationError,
  RpcOrganizationNotFoundError,
  RpcOrganizationServiceError,
} from "@voidhash/rpc";
import * as Effect from "effect/Effect";

export const OrganizationRpcsLive = OrganizationRpcsDef.toLayer(
  Effect.gen(function* OrganizationRpcsLive() {
    const organizationService = yield* OrganizationService;
    return {
      CreateOrganization: ({ name }) =>
        organizationService.createOrganization({ name }).pipe(
          Effect.catchTags({
            OrganizationServiceError: (error) =>
              Effect.fail(new RpcOrganizationServiceError({ cause: error.cause })),
          }),
        ),
      DeleteOrganization: ({ organizationId }) =>
        organizationService.deleteOrganization({ organizationId }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            OrganizationServiceError: (error) =>
              Effect.fail(new RpcOrganizationServiceError({ cause: error.cause })),
          }),
        ),
      RemoveOrganizationAvatar: ({ organizationId }) =>
        organizationService.removeAvatar({ organizationId }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            OrganizationNotFoundError: (error) =>
              Effect.fail(new RpcOrganizationNotFoundError({ message: error.message })),
            OrganizationServiceError: (error) =>
              Effect.fail(new RpcOrganizationServiceError({ cause: error.cause })),
          }),
        ),
      SetOrganizationAvatar: ({ contentType, imageBase64, organizationId }) =>
        organizationService.setAvatar({ contentType, imageBase64, organizationId }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            AvatarValidationError: (error) =>
              Effect.fail(new RpcAvatarValidationError({ message: error.message })),
            OrganizationNotFoundError: (error) =>
              Effect.fail(new RpcOrganizationNotFoundError({ message: error.message })),
            OrganizationServiceError: (error) =>
              Effect.fail(new RpcOrganizationServiceError({ cause: error.cause })),
          }),
        ),
      UpdateOrganization: ({ name, organizationId }) =>
        organizationService.updateOrganization({ name, organizationId }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            OrganizationNotFoundError: (error) =>
              Effect.fail(new RpcOrganizationNotFoundError({ message: error.message })),
            OrganizationServiceError: (error) =>
              Effect.fail(new RpcOrganizationServiceError({ cause: error.cause })),
          }),
        ),
    };
  }),
);
