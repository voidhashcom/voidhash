import { AppStoreReconcileOriginalTransactionWorkflow } from "@voidhash/core/services/paymentProviders/AppStoreReconcileOriginalTransactionWorkflow";
import { AppStoreReplayParkedNotificationsWorkflow } from "@voidhash/core/services/paymentProviders/AppStoreReplayParkedNotificationsWorkflow";
import { AppStoreReplayParkedSdkNotificationsWorkflow } from "@voidhash/core/services/paymentProviders/AppStoreReplayParkedSdkNotificationsWorkflow";
import { GooglePlayReplayParkedNotificationsWorkflow } from "@voidhash/core/services/paymentProviders/GooglePlayReplayParkedNotificationsWorkflow";
import { StripeReplayParkedNotificationsWorkflow } from "@voidhash/core/services/paymentProviders/StripeReplayParkedNotificationsWorkflow";
import { IdentifyDistinctIdCompletionWorkflow } from "@voidhash/core/services/personIdentity/IdentifyDistinctIdCompletionWorkflow";
import { WebhookDeliveryWorkflow } from "@voidhash/core/services/webhookDispatch/WebhookDeliveryWorkflow";
import { Db } from "@voidhash/db";
import { PlatformRuntime } from "@orbian/sdk/PlatformRuntime";
import { WorkflowRunner } from "@orbian/sdk/Workflow";
import { NodePlatformRuntimeLive } from "../runtime/PlatformRuntime.ts";
import { PgWorkflowRunnerLive } from "../runtime/Workflow.ts";
import { Effect, Layer, Redacted } from "effect";

import type { SelfhostRuntimeConfig } from "../config.ts";
import { registerIdentityCompletionWorkflow } from "./IdentityCompletionWorkflow.ts";
import { registerPaymentProviderWorkflows } from "./PaymentProviderWorkflows.ts";
import { registerWebhookDeliveryWorkflow } from "./WebhookDeliveryWorkflow.ts";
import {
  AppStoreReconcileOriginalTransactionDefinition,
  AppStoreReplayParkedNotificationsDefinition,
  AppStoreReplayParkedSdkNotificationsDefinition,
  DeliverWebhookDefinition,
  GooglePlayReplayParkedNotificationsDefinition,
  IdentifyDistinctIdCompletionDefinition,
  StripeReplayParkedNotificationsDefinition,
} from "./WorkflowDefinitions.ts";

const logDispatchFailure = (workflowName: string) => (cause: unknown) =>
  Effect.logError("Failed to dispatch self-host workflow", { cause, workflowName });

const makeWorkflowPortsLive = Layer.mergeAll(
  Layer.effect(
    WebhookDeliveryWorkflow,
    Effect.gen(function* () {
      const runner = yield* WorkflowRunner;
      const runtime = yield* PlatformRuntime;
      return {
        dispatch: (input: Parameters<WebhookDeliveryWorkflow["Service"]["dispatch"]>[0]) =>
          runner.dispatch(DeliverWebhookDefinition, input).pipe(
            Effect.provideService(PlatformRuntime, runtime),
            Effect.tapError(logDispatchFailure(DeliverWebhookDefinition.name)),
            Effect.orDie,
            Effect.asVoid,
          ),
      };
    }),
  ),
  Layer.effect(
    IdentifyDistinctIdCompletionWorkflow,
    Effect.gen(function* () {
      const runner = yield* WorkflowRunner;
      const runtime = yield* PlatformRuntime;
      return {
        dispatch: (
          input: Parameters<IdentifyDistinctIdCompletionWorkflow["Service"]["dispatch"]>[0],
        ) =>
          runner.dispatch(IdentifyDistinctIdCompletionDefinition, input).pipe(
            Effect.provideService(PlatformRuntime, runtime),
            Effect.tapError(logDispatchFailure(IdentifyDistinctIdCompletionDefinition.name)),
            Effect.orDie,
            Effect.asVoid,
          ),
      };
    }),
  ),
  Layer.effect(
    AppStoreReplayParkedNotificationsWorkflow,
    Effect.gen(function* () {
      const runner = yield* WorkflowRunner;
      const runtime = yield* PlatformRuntime;
      return {
        dispatch: (
          input: Parameters<AppStoreReplayParkedNotificationsWorkflow["Service"]["dispatch"]>[0],
        ) =>
          runner.dispatch(AppStoreReplayParkedNotificationsDefinition, input).pipe(
            Effect.provideService(PlatformRuntime, runtime),
            Effect.tapError(
              logDispatchFailure(AppStoreReplayParkedNotificationsDefinition.name),
            ),
            Effect.orDie,
            Effect.asVoid,
          ),
      };
    }),
  ),
  Layer.effect(
    AppStoreReplayParkedSdkNotificationsWorkflow,
    Effect.gen(function* () {
      const runner = yield* WorkflowRunner;
      const runtime = yield* PlatformRuntime;
      return {
        dispatch: (
          input: Parameters<
            AppStoreReplayParkedSdkNotificationsWorkflow["Service"]["dispatch"]
          >[0],
        ) =>
          runner.dispatch(AppStoreReplayParkedSdkNotificationsDefinition, input).pipe(
            Effect.provideService(PlatformRuntime, runtime),
            Effect.tapError(
              logDispatchFailure(AppStoreReplayParkedSdkNotificationsDefinition.name),
            ),
            Effect.orDie,
            Effect.asVoid,
          ),
      };
    }),
  ),
  Layer.effect(
    AppStoreReconcileOriginalTransactionWorkflow,
    Effect.gen(function* () {
      const runner = yield* WorkflowRunner;
      const runtime = yield* PlatformRuntime;
      return {
        dispatch: (
          input: Parameters<
            AppStoreReconcileOriginalTransactionWorkflow["Service"]["dispatch"]
          >[0],
        ) =>
          runner.dispatch(AppStoreReconcileOriginalTransactionDefinition, input).pipe(
            Effect.provideService(PlatformRuntime, runtime),
            Effect.tapError(
              logDispatchFailure(AppStoreReconcileOriginalTransactionDefinition.name),
            ),
            Effect.orDie,
            Effect.asVoid,
          ),
      };
    }),
  ),
  Layer.effect(
    GooglePlayReplayParkedNotificationsWorkflow,
    Effect.gen(function* () {
      const runner = yield* WorkflowRunner;
      const runtime = yield* PlatformRuntime;
      return {
        dispatch: (
          input: Parameters<
            GooglePlayReplayParkedNotificationsWorkflow["Service"]["dispatch"]
          >[0],
        ) =>
          runner.dispatch(GooglePlayReplayParkedNotificationsDefinition, input).pipe(
            Effect.provideService(PlatformRuntime, runtime),
            Effect.tapError(
              logDispatchFailure(GooglePlayReplayParkedNotificationsDefinition.name),
            ),
            Effect.orDie,
            Effect.asVoid,
          ),
      };
    }),
  ),
  Layer.effect(
    StripeReplayParkedNotificationsWorkflow,
    Effect.gen(function* () {
      const runner = yield* WorkflowRunner;
      const runtime = yield* PlatformRuntime;
      return {
        dispatch: (
          input: Parameters<StripeReplayParkedNotificationsWorkflow["Service"]["dispatch"]>[0],
        ) =>
          runner.dispatch(StripeReplayParkedNotificationsDefinition, input).pipe(
            Effect.provideService(PlatformRuntime, runtime),
            Effect.tapError(logDispatchFailure(StripeReplayParkedNotificationsDefinition.name)),
            Effect.orDie,
            Effect.asVoid,
          ),
      };
    }),
  ),
);

/** Builds the workflow runner and every asynchronous backend dispatch port. */
export const makeSelfhostWorkflowRuntimeLive = (config: SelfhostRuntimeConfig) => {
  const workflowRunner = PgWorkflowRunnerLive({
    database: config.database.databaseName,
    host: config.database.host,
    password: Redacted.make(config.database.password),
    port: config.database.port,
    ...(config.database.ssl === undefined ? {} : { ssl: config.database.ssl }),
    username: config.database.username,
  });
  const runtime = Layer.merge(workflowRunner, NodePlatformRuntimeLive);
  const ports = makeWorkflowPortsLive.pipe(Layer.provide(runtime));
  return Layer.merge(runtime, ports);
};

/** Registers every workflow handler before the HTTP server begins accepting requests. */
export const registerSelfhostWorkflows = (config: SelfhostRuntimeConfig) =>
  Effect.gen(function* () {
    const runner = yield* WorkflowRunner;
    const completion = yield* IdentifyDistinctIdCompletionWorkflow;
    const database = Db.layer(config.database);
    yield* registerIdentityCompletionWorkflow(runner, database);
    yield* registerWebhookDeliveryWorkflow(runner, database);
    yield* registerPaymentProviderWorkflows(runner, database, completion);
  });
