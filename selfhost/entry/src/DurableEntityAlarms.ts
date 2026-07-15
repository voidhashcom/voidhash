import type { DurableEntityAddress } from "@voidhash/platform/DurableEntity";
import type { NodeDurableEntityControlShape } from "@voidhash/platform-node/DurableEntity";
import { Effect } from "effect";

/** Handler for one durable-entity alarm type. */
export type DurableEntityAlarmHandler = (
  address: DurableEntityAddress,
  now: number,
) => Effect.Effect<void, unknown>;

/** Dispatches one bounded page of due alarms through the registered type handlers. */
export const dispatchDurableEntityAlarms = (
  control: NodeDurableEntityControlShape,
  handlers: Readonly<Record<string, DurableEntityAlarmHandler>>,
  now = Date.now(),
): Effect.Effect<void, unknown> =>
  control
    .listDueAlarms(now, 100)
    .pipe(
      Effect.flatMap((due) =>
        Effect.forEach(
          due,
          ({ address }) => handlers[address.type]?.(address, now) ?? Effect.void,
          { discard: true },
        ),
      ),
    );
