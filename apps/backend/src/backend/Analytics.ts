import { AnalyticsEventStore } from "@voidhash/core/services/analytics/AnalyticsEventStore";
import { AnalyticsDispatchService } from "@voidhash/core/services/analyticsIngest/AnalyticsDispatchService";
import { EventCaptureService } from "@voidhash/core/services/analyticsIngest/EventCaptureService";
import { Db } from "@voidhash/db";
import { Layer } from "effect";

import type { SelfhostRuntimeConfig } from "../config.ts";

/** Builds the synchronous PostgreSQL analytics services for Community self-host. */
export const makeSelfhostAnalyticsRuntimeLive = (
  config: SelfhostRuntimeConfig,
): Layer.Layer<AnalyticsEventStore | AnalyticsDispatchService | EventCaptureService> => {
  const database = Db.layer(config.database);
  const store = AnalyticsEventStore.layer.pipe(Layer.provide(database));
  const capture = EventCaptureService.layer.pipe(
    Layer.provide(store),
    Layer.provide(database),
  );
  const dispatch = AnalyticsDispatchService.layer.pipe(Layer.provide(store));
  return Layer.mergeAll(store, capture, dispatch);
};
