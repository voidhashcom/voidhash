import type {
  DurableEntityAddress,
  DurableEntityAlarmControlShape,
} from "@voidhash/platform/DurableEntity";
import { Clock, Effect } from "effect";

/** Handler for one durable-entity alarm type. */
export type DurableEntityAlarmHandler = (
  address: DurableEntityAddress,
  now: number,
) => Effect.Effect<void, unknown>;

/**
 * Dispatches one bounded page of due alarms through the registered type handlers.
 * When `now` is omitted, the clock is sampled each time the returned effect runs.
 */
export const dispatchDurableEntityAlarms = (
  control: DurableEntityAlarmControlShape,
  handlers: Readonly<Record<string, DurableEntityAlarmHandler>>,
  now?: number,
): Effect.Effect<void, unknown> =>
  Effect.gen(function* () {
    const dispatchTime = now ?? (yield* Clock.currentTimeMillis);
    const due = yield* control.listDueAlarms(dispatchTime, 100);
    yield* Effect.forEach(
      due,
      ({ address }) => handlers[address.type]?.(address, dispatchTime) ?? Effect.void,
      { discard: true },
    );
  });
