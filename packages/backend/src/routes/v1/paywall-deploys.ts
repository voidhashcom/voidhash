import {
  createdResponse,
  CreatePaywallDeployResponse,
  FinalizePaywallDeployResponse,
  FinalizedPaywallDeployComponent,
  FinalizedPaywallDeployPaywall,
  PaywallDeploy,
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
import { PaywallDeployService, type PaywallDeployListItem } from "@voidhash/core/services";
import { paginate, resolveRequestProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession, requireCredential } from "../../ApiMiddlewares.ts";

/** Projects a stored deploy onto the public resource shape. */
const toDeploy = (item: PaywallDeployListItem) =>
  new PaywallDeploy({
    cliVersion: item.cliVersion,
    components: item.components.map((component) => ({
      ...component,
      componentId: Option.getOrNull(component.componentId),
      version: Option.getOrNull(component.version),
    })),
    createdAt: item.createdAt,
    createdByName: item.createdByName,
    id: item.id,
    paywalls: item.paywalls.map((paywall) => ({
      ...paywall,
      releaseId: Option.getOrNull(paywall.releaseId),
      version: Option.getOrNull(paywall.version),
    })),
    runtimeVersion: item.runtimeVersion,
    schemaVersion: item.schemaVersion,
    status: item.status,
  });

/**
 * Handlers for the paywall code-deploy surface (deploy contract §4): the
 * create / upload / finalize write protocol plus the list and read-back
 * endpoints. All of them call {@link PaywallDeployService} under the caller's
 * bridged `AuthSession`; the write path authorizes against the manifest's
 * team/project slugs, the read path against the resolved project.
 */
export const PaywallDeploysGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "paywall_deploys",
  (handlers) =>
    Effect.gen(function* () {
      const deployService = yield* PaywallDeployService;

      return handlers
        .handle("listDeploys", ({ query }) =>
          bridgeAuthSession(
            Effect.fn("PaywallDeploysGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, ["user", "secret-key"]);
              const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
              const deploys = yield* deployService.listDeploys({ projectId });
              const filtered = deploys.filter(
                (deploy) => query.status === undefined || deploy.status === query.status,
              );
              return yield* paginate(filtered.map(toDeploy), (deploy) => deploy.id, query);
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PaywallDeployServiceError: (e) =>
                Effect.fail(new ApiPaywallDeployServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("getDeploy", ({ params, query }) =>
          bridgeAuthSession(
            Effect.fn("PaywallDeploysGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, ["user", "secret-key"]);
              const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
              // The service has no by-id accessor; the deploy is read out of
              // its project's listing, which is already permission-checked.
              const deploys = yield* deployService.listDeploys({ projectId });
              const deploy = deploys.find((candidate) => candidate.id === params.deployId);
              if (!deploy) {
                return yield* Effect.fail(
                  new ApiPaywallDeployNotFoundError({
                    message: `Paywall deploy not found: ${params.deployId}`,
                  }),
                );
              }
              return toDeploy(deploy);
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PaywallDeployServiceError: (e) =>
                Effect.fail(new ApiPaywallDeployServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("createDeploy", ({ payload }) =>
          bridgeAuthSession(
            deployService.createDeploy({ manifest: payload }).pipe(
              Effect.flatMap((result) => {
                const created = new CreatePaywallDeployResponse({
                  deployId: result.deployId,
                  missing: result.missing,
                });
                return createdResponse(
                  CreatePaywallDeployResponse,
                  created,
                  `/paywall-deploys/${created.deployId}`,
                );
              }),
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
