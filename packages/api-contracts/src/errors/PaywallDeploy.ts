import { Schema } from "effect";

/** Generic paywall deploy service error */
export class ApiPaywallDeployServiceError extends Schema.TaggedErrorClass<ApiPaywallDeployServiceError>()(
  "Api/PaywallDeployServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/**
 * The manifest declares a `schemaVersion` this server does not understand
 * (deploy contract §4.1/§8). `message` carries the "upgrade voidhash-cli"
 * hint verbatim from the service.
 */
export class ApiPaywallDeployUpgradeRequiredError extends Schema.TaggedErrorClass<ApiPaywallDeployUpgradeRequiredError>()(
  "Api/PaywallDeployUpgradeRequiredError",
  {
    message: Schema.String,
    schemaVersion: Schema.NullOr(Schema.Number),
  },
  { httpApiStatus: 400 },
) {}

/**
 * The manifest (or a stored component manifest / preview tree) failed schema
 * validation or a §1.1 constraint (deploy contract §4.3). `violations`
 * carries the per-item details.
 */
export class ApiPaywallDeployValidationError extends Schema.TaggedErrorClass<ApiPaywallDeployValidationError>()(
  "Api/PaywallDeployValidationError",
  {
    message: Schema.String,
    violations: Schema.Array(Schema.String),
  },
  { httpApiStatus: 422 },
) {}

/** Paywall deploy not found */
export class ApiPaywallDeployNotFoundError extends Schema.TaggedErrorClass<ApiPaywallDeployNotFoundError>()(
  "Api/PaywallDeployNotFoundError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

/** Blob upload attempted against a deploy that is no longer pending */
export class ApiPaywallDeployNotPendingError extends Schema.TaggedErrorClass<ApiPaywallDeployNotPendingError>()(
  "Api/PaywallDeployNotPendingError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 409 },
) {}

/** Uploaded sha256 is not declared by the deploy's manifest (contract §4.2) */
export class ApiDeployBlobNotDeclaredError extends Schema.TaggedErrorClass<ApiDeployBlobNotDeclaredError>()(
  "Api/DeployBlobNotDeclaredError",
  {
    sha256: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

/** Uploaded body does not hash to the declared sha256 (contract §4.2) */
export class ApiDeployBlobHashMismatchError extends Schema.TaggedErrorClass<ApiDeployBlobHashMismatchError>()(
  "Api/DeployBlobHashMismatchError",
  {
    actualSha256: Schema.String,
    expectedSha256: Schema.String,
  },
  { httpApiStatus: 422 },
) {}

/**
 * Finalize attempted while referenced blobs are still missing (contract
 * §4.3). The deploy stays pending; the CLI uploads `missing` and retries.
 */
export class ApiIncompleteDeployError extends Schema.TaggedErrorClass<ApiIncompleteDeployError>()(
  "Api/IncompleteDeployError",
  {
    missing: Schema.Array(Schema.String),
  },
  { httpApiStatus: 409 },
) {}
