import type { DurableEntityAddress } from "@orbian/sdk/DurableEntity";
import type { NodeDurableEntityControlShape } from "./runtime/DurableEntity.ts";
import { Effect } from "effect";

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
  control: NodeDurableEntityControlShape,
  handlers: Readonly<Record<string, DurableEntityAlarmHandler>>,
  now?: number,
): Effect.Effect<void, unknown> =>
  Effect.suspend(() => {
    const dispatchTime = now ?? Date.now();
    return control
      .listDueAlarms(dispatchTime, 100)
      .pipe(
        Effect.flatMap((due) =>
          Effect.forEach(
            due,
            ({ address }) =>
              handlers[address.type]?.(address, dispatchTime) ?? Effect.void,
            { discard: true },
          ),
        ),
      );
  });
