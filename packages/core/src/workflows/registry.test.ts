import { DateTime, Effect } from "effect";

import { constant } from "@voidhash/lib/lang";
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
import { describe, expect, it } from "../testing/effect-vitest.ts";
import { backendWorkflows } from "./registry.ts";

const workflowNames = constant([
  "DeliverWebhookWorkflow",
  "FxRateSyncWorkflow",
  "PurchaseLedgerDrainWorkflow",
  "AppStoreExpireParkedNotificationsWorkflow",
  "AppStoreReplayParkedNotificationsWorkflow",
  "AppStoreReplayParkedSdkNotificationsWorkflow",
  "AppStoreReconcileOriginalTransactionWorkflow",
  "GooglePlayReplayParkedNotificationsWorkflow",
  "StripeReplayParkedNotificationsWorkflow",
]);

describe("backend workflow registry", () => {
  it("contains the canonical workflow set and cron metadata", () => {
    expect(backendWorkflows.map((registration) => registration.workflow.name)).toEqual(
      workflowNames,
    );
    expect(
      backendWorkflows.flatMap((registration) => {
        const cron = registration.cron;
        if (!cron) return [];
        return [constant([registration.workflow.name, cron.schedule])];
      }),
    ).toEqual([
      ["FxRateSyncWorkflow", "0 5 * * *"],
      ["PurchaseLedgerDrainWorkflow", "* * * * *"],
      ["AppStoreExpireParkedNotificationsWorkflow", "0 4 * * *"],
    ]);
  });

  it.effect("derives cron payloads from the scheduled time", () =>
    Effect.gen(function* () {
      const runner = TestWorkflowRunner.make();
      const scheduledTime = DateTime.toDateUtc(DateTime.makeUnsafe("2026-08-05T05:00:00.000Z"));

      yield* Effect.forEach(
        backendWorkflows,
        (registration) => registration.cron?.dispatch(scheduledTime) ?? Effect.void,
        { discard: true },
      ).pipe(
        Effect.provideService(WorkflowRunner, runner),
        Effect.provideService(PlatformRuntime, PlatformRuntime.of({})),
      );

      expect(runner.dispatches.map(({ payload, workflow }) => [workflow.name, payload])).toEqual([
        ["FxRateSyncWorkflow", { runId: scheduledTime.toISOString() }],
        ["PurchaseLedgerDrainWorkflow", { runId: scheduledTime.toISOString() }],
        ["AppStoreExpireParkedNotificationsWorkflow", { triggeredAt: scheduledTime.toISOString() }],
      ]);
    }),
  );

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

  it.effect("bounds long durable operation names deterministically", () =>
    Effect.gen(function* () {
      const short = "app-store-replay:configuration:product";
      const long = `app-store-replay:${"configuration".repeat(24)}:${"product".repeat(24)}`;

      expect(yield* Workflow.durableOperationName(short)).toBe(short);
      const first = yield* Workflow.durableOperationName(long);
      const second = yield* Workflow.durableOperationName(long);

      expect(first).toBe(second);
      expect(new TextEncoder().encode(first).byteLength).toBeLessThanOrEqual(96);
      expect(first).not.toBe(long);
    }),
  );
});
