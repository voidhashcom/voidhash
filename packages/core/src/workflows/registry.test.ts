import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import * as TestWorkflowRunner from "@voidhash/platform/TestWorkflowRunner";
import * as Workflow from "@voidhash/platform/Workflow";
import { WorkflowRunner } from "@voidhash/platform/WorkflowRunner";
import {
  AppStoreReplayParkedNotifications,
  AppStoreReplayParkedSdkNotifications,
  GooglePlayReplayParkedNotifications,
  StripeReplayParkedNotifications,
} from "./definitions.ts";
import { backendWorkflows } from "./registry.ts";

const workflowNames = [
  "DeliverWebhookWorkflow",
  "FxRateSyncWorkflow",
  "PurchaseLedgerDrainWorkflow",
  "AppStoreExpireParkedNotificationsWorkflow",
  "AppStoreReplayParkedNotificationsWorkflow",
  "AppStoreReplayParkedSdkNotificationsWorkflow",
  "AppStoreReconcileOriginalTransactionWorkflow",
  "GooglePlayReplayParkedNotificationsWorkflow",
  "StripeReplayParkedNotificationsWorkflow",
] as const;

describe("backend workflow registry", () => {
  it("contains the canonical workflow set and cron metadata", () => {
    expect(backendWorkflows.map((registration) => registration.workflow.name)).toEqual(
      workflowNames,
    );
    expect(
      backendWorkflows.flatMap((registration) =>
        registration.cron
          ? [[registration.workflow.name, registration.cron.schedule] as const]
          : [],
      ),
    ).toEqual([
      ["FxRateSyncWorkflow", "0 5 * * *"],
      ["PurchaseLedgerDrainWorkflow", "* * * * *"],
      ["AppStoreExpireParkedNotificationsWorkflow", "0 4 * * *"],
    ]);
  });

  it("derives cron payloads from the scheduled time", async () => {
    const runner = TestWorkflowRunner.make();
    const scheduledTime = new Date("2026-08-05T05:00:00.000Z");

    await Effect.runPromise(
      Effect.forEach(
        backendWorkflows,
        (registration) => registration.cron?.dispatch(scheduledTime) ?? Effect.void,
        { discard: true },
      ).pipe(
        Effect.provideService(WorkflowRunner, runner),
        Effect.provideService(PlatformRuntime, PlatformRuntime.of({})),
      ),
    );

    expect(runner.dispatches.map(({ payload, workflow }) => [workflow.name, payload])).toEqual([
      ["FxRateSyncWorkflow", { runId: scheduledTime.toISOString() }],
      ["PurchaseLedgerDrainWorkflow", { runId: scheduledTime.toISOString() }],
      ["AppStoreExpireParkedNotificationsWorkflow", { triggeredAt: scheduledTime.toISOString() }],
    ]);
  });

  it("includes requestedAt in every replay idempotency key", () => {
    const productReplay = {
      paymentProviderConfigurationId: "configuration",
      paymentProviderProductId: "product",
      providerProductKey: "provider-key",
    };
    const sdkReplay = {
      originalTransactionId: "original-transaction",
      paymentProviderConfigurationId: "configuration",
    };

    for (const workflow of [
      AppStoreReplayParkedNotifications,
      GooglePlayReplayParkedNotifications,
      StripeReplayParkedNotifications,
    ]) {
      expect(workflow.idempotencyKey({ ...productReplay, requestedAt: "first" })).not.toBe(
        workflow.idempotencyKey({ ...productReplay, requestedAt: "second" }),
      );
    }
    expect(
      AppStoreReplayParkedSdkNotifications.idempotencyKey({
        ...sdkReplay,
        requestedAt: "first",
      }),
    ).not.toBe(
      AppStoreReplayParkedSdkNotifications.idempotencyKey({
        ...sdkReplay,
        requestedAt: "second",
      }),
    );
  });

  it("bounds long durable operation names deterministically", async () => {
    const short = "app-store-replay:configuration:product";
    const long = `app-store-replay:${"configuration".repeat(24)}:${"product".repeat(24)}`;

    expect(await Effect.runPromise(Workflow.durableOperationName(short))).toBe(short);
    const first = await Effect.runPromise(Workflow.durableOperationName(long));
    const second = await Effect.runPromise(Workflow.durableOperationName(long));

    expect(first).toBe(second);
    expect(new TextEncoder().encode(first).byteLength).toBeLessThanOrEqual(96);
    expect(first).not.toBe(long);
  });
});
