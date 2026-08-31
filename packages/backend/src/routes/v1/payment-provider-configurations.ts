import {
  createdResponse,
  PaymentProviderConfigurationDetail,
  VoidhashV1Api,
} from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiPaymentProviderAlreadyExistsError,
  ApiPaymentProviderConfigurationInUseError,
  ApiPaymentProviderConfigurationKeyUnavailableError,
  ApiPaymentProviderConfigurationNotFoundError,
  ApiPaymentProviderConfigurationServiceError,
  ApiPaymentProviderConfigurationValidationError,
} from "@voidhash/api-contracts/errors";
import { PaymentProviderConfigurationService } from "@voidhash/core-v2";
import { paginate, resolveRequestProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import {
  type ApiCredentialMethod,
  bridgeAuthSession,
  requireCredential,
} from "../../ApiMiddlewares.ts";

/** Provider credentials are never client-safe, so publishable keys are out. */
const MANAGEMENT_CREDENTIALS: ReadonlyArray<ApiCredentialMethod> = ["user", "secret-key"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toConfiguration = (value: unknown): Record<string, unknown> => {
  if (isRecord(value)) return value;
  return {};
};

/**
 * True when a configuration field carries a real value. Empty strings, empty
 * objects and empty arrays all mean "not configured yet", which is what a
 * caller wants to know.
 */
export const isPresent = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
};

/**
 * Reduces a raw provider configuration blob to `has<Field>` booleans.
 *
 * The blob holds Apple PKCS8 keys, Stripe secret keys and Google
 * service-account JSON. Field *names* are not secret, values are — so the API
 * reports presence only and the credential itself never leaves the server.
 */
export const configurationPresence = (value: unknown): Record<string, boolean> => {
  if (!isRecord(value)) return {};
  const flags: Record<string, boolean> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    flags[`has${key.charAt(0).toUpperCase()}${key.slice(1)}`] = isPresent(fieldValue);
  }
  return flags;
};

interface ConfigurationRow {
  readonly activeProviderId: string | null;
  readonly configuration: unknown;
  readonly createdAt: Date | null;
  readonly enabled: boolean;
  readonly id: string;
  readonly name: string;
  readonly paymentProviderKey: string;
  readonly projectId: string;
  readonly providerId: string;
  readonly updatedAt: Date | null;
}

/** Secret-stripped read projection shared by every endpoint in this group. */
const toDetail = (row: ConfigurationRow) => ({
  activeProviderId: row.activeProviderId,
  configurationPresence: configurationPresence(row.configuration),
  createdAt: row.createdAt,
  enabled: row.enabled,
  id: row.id,
  name: row.name,
  paymentProviderKey: row.paymentProviderKey,
  projectId: row.projectId,
  providerId: row.providerId,
  updatedAt: row.updatedAt,
});

/** Omits `name` from an update when the caller did not send one, so the stored value survives. */
const nameUpdate = (name: string | undefined): { name?: string } => {
  if (name === undefined) return {};
  return { name };
};

export const PaymentProviderConfigurationsGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "payment_provider_configurations",
  (handlers) =>
    Effect.gen(function* () {
      const service = yield* PaymentProviderConfigurationService;

      return handlers
        .handle("listPaymentProviderConfigurations", ({ query }) =>
          bridgeAuthSession(
            Effect.gen(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
              const configurations = yield* service.getPaymentProviderConfigurations(projectId);
              const matching = configurations.filter(
                (row) => query.providerId === undefined || row.providerId === query.providerId,
              );
              // The service returns rows in database order; cursors only make
              // sense over a stable one.
              const sorted = [...matching].sort((a, b) => a.id.localeCompare(b.id));
              const page = yield* paginate(sorted, (row) => row.id, query);
              return { data: page.data.map(toDetail), pageInfo: page.pageInfo };
            }),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PurchaseActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PaymentProviderConfigurationServiceError: (e) =>
                Effect.fail(new ApiPaymentProviderConfigurationServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("createPaymentProviderConfiguration", ({ payload }) =>
          bridgeAuthSession(
            Effect.gen(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              const projectId = yield* resolveRequestProjectId(authSession, payload.projectId);
              const created = yield* service.createPaymentProviderConfiguration({
                projectId,
                providerId: payload.providerId,
              });
              const row = yield* service.getPaymentProviderConfigurationById(created.id);
              const detail = toDetail(row);
              return yield* createdResponse(
                PaymentProviderConfigurationDetail,
                detail,
                `/payment-provider-configurations/${detail.id}`,
              );
            }),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PurchaseActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PaymentProviderAlreadyExistsError: (e) =>
                Effect.fail(new ApiPaymentProviderAlreadyExistsError({ message: e.message })),
              PaymentProviderConfigurationNotFoundError: (e) =>
                Effect.fail(
                  new ApiPaymentProviderConfigurationNotFoundError({ message: e.message }),
                ),
              PaymentProviderConfigurationServiceError: (e) =>
                Effect.fail(new ApiPaymentProviderConfigurationServiceError({ cause: e.cause })),
              PaymentProviderConfigurationValidationError: (e) =>
                Effect.fail(new ApiPaymentProviderConfigurationValidationError({ cause: e.cause })),
            }),
          ),
        )
        .handle("getPaymentProviderConfiguration", ({ params }) =>
          bridgeAuthSession(
            Effect.gen(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              const row = yield* service.getPaymentProviderConfigurationById(
                params.configurationId,
              );
              return toDetail(row);
            }),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PurchaseActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PaymentProviderConfigurationNotFoundError: (e) =>
                Effect.fail(
                  new ApiPaymentProviderConfigurationNotFoundError({ message: e.message }),
                ),
              PaymentProviderConfigurationServiceError: (e) =>
                Effect.fail(new ApiPaymentProviderConfigurationServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("updatePaymentProviderConfiguration", ({ params, payload }) =>
          bridgeAuthSession(
            Effect.gen(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              // The update service call takes a full row, so omitted fields are
              // read back from the stored configuration rather than blanked.
              const existing = yield* service.getPaymentProviderConfigurationById(
                params.configurationId,
              );
              yield* service.updatePaymentProviderConfiguration({
                configuration: payload.configuration ?? toConfiguration(existing.configuration),
                enabled: payload.enabled ?? existing.enabled,
                id: params.configurationId,
                ...nameUpdate(payload.name),
              });
              const row = yield* service.getPaymentProviderConfigurationById(
                params.configurationId,
              );
              return toDetail(row);
            }),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PurchaseActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PaymentProviderConfigurationKeyUnavailableError: (e) =>
                Effect.fail(
                  new ApiPaymentProviderConfigurationKeyUnavailableError({ message: e.message }),
                ),
              PaymentProviderConfigurationNotFoundError: (e) =>
                Effect.fail(
                  new ApiPaymentProviderConfigurationNotFoundError({ message: e.message }),
                ),
              PaymentProviderConfigurationServiceError: (e) =>
                Effect.fail(new ApiPaymentProviderConfigurationServiceError({ cause: e.cause })),
              PaymentProviderConfigurationValidationError: (e) =>
                Effect.fail(new ApiPaymentProviderConfigurationValidationError({ cause: e.cause })),
            }),
          ),
        )
        .handle("deletePaymentProviderConfiguration", ({ params }) =>
          bridgeAuthSession(
            Effect.gen(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              return yield* service.deletePaymentProviderConfiguration({
                paymentProviderConfigurationId: params.configurationId,
              });
            }),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PurchaseActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              PaymentProviderConfigurationInUseError: (e) =>
                Effect.fail(new ApiPaymentProviderConfigurationInUseError({ message: e.message })),
              PaymentProviderConfigurationNotFoundError: (e) =>
                Effect.fail(
                  new ApiPaymentProviderConfigurationNotFoundError({ message: e.message }),
                ),
              PaymentProviderConfigurationServiceError: (e) =>
                Effect.fail(new ApiPaymentProviderConfigurationServiceError({ cause: e.cause })),
            }),
          ),
        );
    }),
);
