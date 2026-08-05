import {
  CreatePaywallDeployResponse,
  FinalizePaywallDeployResponse,
  FinalizedPaywallDeployComponent,
  FinalizedPaywallDeployPaywall,
  UploadPaywallDeployBlobResponse,
  VoidhashV1Api,
} from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiDeployBlobHashMismatchError,
  ApiDeployBlobNotDeclaredError,
  ApiIncompleteDeployError,
  ApiPaywallDeployNotFoundError,
  ApiPaywallDeployNotPendingError,
  ApiPaywallDeployServiceError,
  ApiPaywallDeployUpgradeRequiredError,
  ApiPaywallDeployValidationError,
} from "@voidhash/api-contracts/errors";
import { PaywallDeployService } from "@voidhash/core/services";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession } from "../../ApiMiddlewares.ts";

/**
 * Handlers for the paywall code-deploy surface (deploy contract §4):
 * `POST /api/v1/paywall-deploys`, blob upload, and finalize. All three call
 * {@link PaywallDeployService} under the caller's bridged `AuthSession`; the
 * service authorizes against the manifest's team/project slugs.
 */
export const PaywallDeploysGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "paywall_deploys",
  (handlers) =>
    Effect.gen(function* () {
      const deployService = yield* PaywallDeployService;

      return handlers
        .handle("createDeploy", ({ payload }) =>
          bridgeAuthSession(
            deployService.createDeploy({ manifest: payload }).pipe(
              Effect.map(
                (result) =>
                  new CreatePaywallDeployResponse({
                    deployId: result.deployId,
                    missing: result.missing,
                  }),
              ),
            ),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              AuditLogPortError: (e) =>
                Effect.fail(new ApiPaywallDeployServiceError({ cause: e.cause })),
              PaywallDeployServiceError: (e) =>
                Effect.fail(new ApiPaywallDeployServiceError({ cause: e.cause })),
              PaywallDeployValidationError: (e) =>
                Effect.fail(
                  new ApiPaywallDeployValidationError({
                    message: e.message,
                    violations: e.violations,
                  }),
                ),
              UnsupportedDeploySchemaVersionError: (e) =>
                Effect.fail(
                  new ApiPaywallDeployUpgradeRequiredError({
                    message: e.message,
                    schemaVersion: e.schemaVersion,
                  }),
                ),
            }),
          ),
        )
        .handle("uploadBlob", ({ params, payload }) =>
          bridgeAuthSession(
            deployService
              .uploadBlob({
                body: payload,
                deployId: params.deployId,
                sha256: params.sha256,
              })
              .pipe(Effect.map(() => new UploadPaywallDeployBlobResponse({}))),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              DeployBlobHashMismatchError: (e) =>
                Effect.fail(
                  new ApiDeployBlobHashMismatchError({
                    actualSha256: e.actualSha256,
                    expectedSha256: e.expectedSha256,
                  }),
                ),
              DeployBlobNotDeclaredError: (e) =>
                Effect.fail(new ApiDeployBlobNotDeclaredError({ sha256: e.sha256 })),
              PaywallDeployNotFoundError: (e) =>
                Effect.fail(new ApiPaywallDeployNotFoundError({ message: e.message })),
              PaywallDeployNotPendingError: (e) =>
                Effect.fail(new ApiPaywallDeployNotPendingError({ message: e.message })),
              PaywallDeployServiceError: (e) =>
                Effect.fail(new ApiPaywallDeployServiceError({ cause: e.cause })),
              PaywallDeployValidationError: (e) =>
                Effect.fail(
                  new ApiPaywallDeployValidationError({
                    message: e.message,
                    violations: e.violations,
                  }),
                ),
            }),
          ),
        )
        .handle("finalizeDeploy", ({ params }) =>
          bridgeAuthSession(
            deployService.finalizeDeploy({ deployId: params.deployId }).pipe(
              Effect.map(
                (result) =>
                  new FinalizePaywallDeployResponse({
                    components: result.components.map(
                      (component) => new FinalizedPaywallDeployComponent(component),
                    ),
                    deployId: result.deployId,
                    paywalls: result.paywalls.map(
                      (paywall) => new FinalizedPaywallDeployPaywall(paywall),
                    ),
                    status: result.status,
                  }),
              ),
            ),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              AuditLogPortError: (e) =>
                Effect.fail(new ApiPaywallDeployServiceError({ cause: e.cause })),
              IncompleteDeployError: (e) =>
                Effect.fail(new ApiIncompleteDeployError({ missing: e.missing })),
              PaywallDeployNotFoundError: (e) =>
                Effect.fail(new ApiPaywallDeployNotFoundError({ message: e.message })),
              PaywallDeployServiceError: (e) =>
                Effect.fail(new ApiPaywallDeployServiceError({ cause: e.cause })),
              PaywallDeployValidationError: (e) =>
                Effect.fail(
                  new ApiPaywallDeployValidationError({
                    message: e.message,
                    violations: e.violations,
                  }),
                ),
            }),
          ),
        );
    }),
);
