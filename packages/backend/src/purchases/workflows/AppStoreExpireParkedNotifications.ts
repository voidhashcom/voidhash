import * as WorkflowRegistration from "@voidhash/platform/WorkflowRegistration";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { APP_STORE_PARKED_SDK_TTL_DAYS } from "../providers/app-store/payment-provider.ts";
import { AppStorePaymentProviderServiceQueries } from "../providers/app-store/payment-provider-service-queries.ts";
import { AppStoreExpireParkedNotifications } from "@voidhash/core-v2";

const dayMillis = 24 * 60 * 60 * 1_000;

/** Daily expiry registration for unconfirmed App Store notifications. */
export const AppStoreExpireParkedNotificationsRegistration = WorkflowRegistration.make(
  AppStoreExpireParkedNotifications,
  {
    dependencies: AppStorePaymentProviderServiceQueries.layer,
    cron: {
      schedule: "0 4 * * *",
      payload: (scheduledTime) => ({ triggeredAt: scheduledTime.toISOString() }),
    },
    run: (input, ctx) =>
      Effect.gen(function* () {
        const parsedTriggeredAt = DateTime.make(input.triggeredAt);
        if (Option.isNone(parsedTriggeredAt)) return { expired: 0 };
        const triggeredAt = DateTime.toEpochMillis(parsedTriggeredAt.value);

        const olderThan = DateTime.toDateUtc(
          DateTime.makeUnsafe(triggeredAt - APP_STORE_PARKED_SDK_TTL_DAYS * dayMillis),
        );
        const expired = yield* ctx.step({
          name: `app-store-expire-parked:${input.triggeredAt}`,
          success: Schema.Struct({ expired: Schema.Number }),
          execute: Effect.fn("execute")(function* () {
            const queries = yield* AppStorePaymentProviderServiceQueries;
            return yield* queries.expireStaleParkedSdkConfirmationRows({ olderThan });
          })(),
        });
        return expired;
      }),
  },
);
