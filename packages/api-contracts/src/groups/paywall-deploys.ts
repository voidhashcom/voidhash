import * as Schema from "effect/Schema";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

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
} from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import { paginated } from "../Pagination.ts";
import {
  PaywallDeploy,
  PaywallDeployItemParams,
  PaywallDeployListParams,
} from "../schemas/paywalls.ts";
import {
  CreatePaywallDeployResponse,
  FinalizePaywallDeployResponse,
  PaywallDeployBlobBody,
  PaywallDeployManifestBody,
  UploadPaywallDeployBlobResponse,
} from "../Schema.ts";

export const PaywallDeploysGroup = HttpApiGroup.make("paywall_deploys")
  /**
   * Lists a project's code deploys, newest first. Closes the read hole in the
   * three-step deploy protocol: a CLI can create, upload and finalize, but had
   * no way to read a deploy's resulting state back.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("listDeploys", "/", {
      query: PaywallDeployListParams,
      success: paginated(PaywallDeploy),
      error: [ApiActionForbiddenError, ApiPaywallDeployServiceError],
    }),
  )
  /**
   * Reads a single deploy, including the per-paywall and per-component
   * summaries resolved against the release and version rows it produced.
   *
   * Credential: secret-key, user.
   */
  .add(
    HttpApiEndpoint.get("getDeploy", "/:deployId", {
      params: { deployId: Schema.String },
      query: PaywallDeployItemParams,
      success: PaywallDeploy,
      error: [ApiActionForbiddenError, ApiPaywallDeployNotFoundError, ApiPaywallDeployServiceError],
    }),
  )
  .add(
    HttpApiEndpoint.post("createDeploy", "/", {
      payload: PaywallDeployManifestBody,
      success: CreatePaywallDeployResponse.pipe(HttpApiSchema.status(201)),
      error: [
        ApiActionForbiddenError,
        ApiPaywallDeployServiceError,
        ApiPaywallDeployUpgradeRequiredError,
        ApiPaywallDeployValidationError,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.put("uploadBlob", "/:deployId/blobs/:sha256", {
      params: { deployId: Schema.String, sha256: Schema.String },
      payload: PaywallDeployBlobBody,
      success: UploadPaywallDeployBlobResponse,
      error: [
        ApiActionForbiddenError,
        ApiDeployBlobHashMismatchError,
        ApiDeployBlobNotDeclaredError,
        ApiPaywallDeployNotFoundError,
        ApiPaywallDeployNotPendingError,
        ApiPaywallDeployServiceError,
        // §1.1 size validation on the actual uploaded bytes (422).
        ApiPaywallDeployValidationError,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.post("finalizeDeploy", "/:deployId/finalize", {
      params: { deployId: Schema.String },
      success: FinalizePaywallDeployResponse,
      error: [
        ApiActionForbiddenError,
        ApiIncompleteDeployError,
        ApiPaywallDeployNotFoundError,
        ApiPaywallDeployServiceError,
        ApiPaywallDeployValidationError,
      ],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/paywall-deploys");
