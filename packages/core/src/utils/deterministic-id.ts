/**
 * Deterministic analytics `event_id` derivation for server-emitted (revenue)
 * analytics events.
 *
 * A server-emitted event is uniquely identified by the triple:
 *   - `anchor`    — the durable per-action anchor: the purchase-ledger
 *                   `idempotency_key`. One ledger row ⇒ exactly one mapper
 *                   invocation, and the ledger's `UNIQUE(idempotency_key)`
 *                   guarantees the anchor is unique per logical action.
 *   - `eventName` — the wire-stable event name (e.g. `$subscription.created`).
 *                   A single action can emit more than one event — a
 *                   subscription start emits `$subscription.created` +
 *                   `$purchase.completed` — so the name disambiguates them.
 *   - `personId`  — the person the event is attributed to. A transfer emits two
 *                   events with the same-family name on the source vs. target
 *                   person, so the person disambiguates the two halves.
 *
 * The triple `(anchor, eventName, personId)` is injective across every revenue
 * mapper, so the derived id is stable across retries / re-dispatch and collides
 * for exactly the duplicates an at-least-once queue may produce — the property
 * the ClickHouse `(project_id, event_id)` pre-insert dedup relies on. This
 * replaces the previous `generateId("analyticsEvent")` (a fresh random id per
 * call), which was the one piece genuinely incompatible with at-least-once
 * delivery.
 *
 * `event_id` is an unbounded ClickHouse `String`, so a structured, legible
 * deterministic string is used rather than a fixed-width hash — that keeps the
 * 17 sync mapper builders synchronous (no need to thread an async hash) and
 * keeps ids debuggable.
 *
 * Injectivity of the encoding: the format is
 * `an_evt_<anchor>:<eventNameSlug>:<personId>`. `eventNameSlug` and `personId`
 * never contain a `:` (the event names come from a fixed reserved set and slug
 * to `[A-Za-z0-9._-]`; person ids are server-issued `person_<cuid2>`), so the
 * string can be parsed unambiguously from the right — the last two `:` split
 * off `personId` and `eventNameSlug`, and everything before is the (possibly
 * `:`-containing) anchor. The mapping from triple to string is therefore
 * collision-free.
 */

import { constant } from "@voidhash/lib/lang";

/** Matches `generateId("analyticsEvent")` so deterministic and legacy ids share a namespace. */
const ANALYTICS_EVENT_ID_PREFIX = constant("an_evt");

/**
 * Slugs an event name to `[A-Za-z0-9._-]`, stripping the `:` separator and the
 * `$` sigil so the encoding stays unambiguously parseable. Injective over the
 * fixed set of reserved revenue event names (they differ in their alphanumeric
 * segments).
 */
const slugEventName = (eventName: string): string => eventName.replaceAll(/[^a-zA-Z0-9._-]/g, "_");

/**
 * Builds a stable, collision-free analytics `event_id` from the
 * `(anchor, eventName, personId)` triple. See the module doc for the
 * injectivity argument.
 */
export const deterministicAnalyticsEventId = ({
  anchor,
  eventName,
  personId,
}: {
  readonly anchor: string;
  readonly eventName: string;
  readonly personId: string;
}): string => `${ANALYTICS_EVENT_ID_PREFIX}_${anchor}:${slugEventName(eventName)}:${personId}`;
