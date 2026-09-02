import * as Arr from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import type { AnalyticsFilterType } from "@voidhash/rpc";

import type { StoredAnalyticsEvent } from "../../application/ports.ts";
import type { EventPathLink, ExecutablePathsDefinition } from "./CustomAnalytics.ts";

/** Event name that carries screen views, the source of `screen_name` path nodes. */
export const SCREEN_PATH_EVENT_NAME = "$screen";
/** Property holding the stable screen identity on a `$screen` event. */
export const SCREEN_NAME_PROPERTY = "$screen_name";

const DEFAULT_SESSION_GAP_SECONDS = 1_800;
const DEFAULT_EDGE_LIMIT = 50;
const CUSTOM_PROPERTY_PREFIX = "event.properties.";

type PathItem = NonNullable<ExecutablePathsDefinition["pathItem"]>;

interface PathNode {
  readonly label: string;
  readonly timestamp: Date;
}

interface LinkAccumulator {
  readonly count: number;
  readonly source: string;
  readonly sourceStep: number;
  readonly target: string;
  readonly targetStep: number;
  readonly transitionSeconds: number;
}

/**
 * The node label an event contributes to a path, or none when the event is
 * not a node for the configured path item. `screen_name` paths are built
 * only from `$screen` events with a non-empty `$screen_name`; everything
 * else is invisible to them, so mixed custom events never split a screen flow.
 */
export const pathItemLabel = (
  event: typeof StoredAnalyticsEvent.Type,
  pathItem: PathItem,
): Option.Option<string> => {
  if (pathItem === "screen_name") {
    if (event.eventName !== SCREEN_PATH_EVENT_NAME) return Option.none();
    const screenName = event.properties[SCREEN_NAME_PROPERTY];
    return P.isString(screenName) && Str.isNonEmpty(screenName)
      ? Option.some(screenName)
      : Option.none();
  }
  return Option.some(event.eventName);
};

const fieldValue = (event: typeof StoredAnalyticsEvent.Type, field: string): unknown => {
  if (field === "event.name") return event.eventName;
  if (field === "person.id") return event.personId ?? event.distinctId;
  if (field.startsWith(CUSTOM_PROPERTY_PREFIX)) {
    return event.properties[field.slice(CUSTOM_PROPERTY_PREFIX.length)];
  }
  return undefined;
};

const isPrimitive = (value: unknown): value is string | number | boolean =>
  P.isString(value) || P.isNumber(value) || P.isBoolean(value);

type PredicateFilter = Extract<AnalyticsFilterType, { readonly type: "predicate" }>;

const isIn = (actual: unknown, expected: PredicateFilter["value"]) =>
  Array.isArray(expected) && isPrimitive(actual) && expected.includes(actual);

const predicateEvaluators: Readonly<
  Record<PredicateFilter["op"], (actual: unknown, expected: PredicateFilter["value"]) => boolean>
> = {
  contains: (actual, expected) =>
    P.isString(actual) && P.isString(expected) && actual.includes(expected),
  eq: (actual, expected) => isPrimitive(actual) && actual === expected,
  exists: (actual) => actual !== undefined && actual !== null,
  // Ordering operators are rejected by validation before execution, so they
  // read as a non-match here rather than as a silent pass.
  gt: () => false,
  gte: () => false,
  in: isIn,
  lt: () => false,
  lte: () => false,
  neq: (actual, expected) => !(isPrimitive(actual) && actual === expected),
  not_in: (actual, expected) => !isIn(actual, expected),
};

/**
 * Portable evaluation of the validated custom filter subset (`eq`, `neq`,
 * `in`, `not_in`, `contains`, `exists` and boolean groups).
 */
export const matchesCustomFilter = (
  event: typeof StoredAnalyticsEvent.Type,
  filter: AnalyticsFilterType,
): boolean => {
  if (filter.type === "not") return !matchesCustomFilter(event, filter.filter);
  // `and`/`or` share one union member, so the group is narrowed by excluding
  // the predicate tag rather than by testing its own.
  if (filter.type !== "predicate") {
    return filter.type === "and"
      ? filter.filters.every((child) => matchesCustomFilter(event, child))
      : filter.filters.some((child) => matchesCustomFilter(event, child));
  }
  return predicateEvaluators[filter.op](fieldValue(event, filter.field), filter.value);
};

const actorKey = (
  event: typeof StoredAnalyticsEvent.Type,
  actor: ExecutablePathsDefinition["actor"],
): Option.Option<string> => {
  if (actor?.kind === "group") {
    const value = event.properties[actor.property];
    return isPrimitive(value) ? Option.some(`group:${String(value)}`) : Option.none();
  }
  return Option.some(event.personId ?? event.distinctId);
};

const byTimestamp = Order.combine(
  Order.mapInput(Order.Date, (event: typeof StoredAnalyticsEvent.Type) => event.eventTimestamp),
  Order.mapInput(Order.String, (event: typeof StoredAnalyticsEvent.Type) => event.eventId),
);

/**
 * Splits one actor's chronologically ordered events into sessions. A new
 * session starts whenever the SDK session id changes or the gap between two
 * consecutive events exceeds the configured inactivity window; the gap rule
 * keeps events without a session id (older SDKs, server-side capture) usable.
 */
export const sessionize = (
  events: ReadonlyArray<typeof StoredAnalyticsEvent.Type>,
  sessionGapSeconds: number,
): ReadonlyArray<ReadonlyArray<typeof StoredAnalyticsEvent.Type>> => {
  const gapMs = sessionGapSeconds * 1_000;
  const startsNewSession = (
    previous: typeof StoredAnalyticsEvent.Type,
    event: typeof StoredAnalyticsEvent.Type,
  ) =>
    (previous.sessionId !== null &&
      event.sessionId !== null &&
      previous.sessionId !== event.sessionId) ||
    event.eventTimestamp.getTime() - previous.eventTimestamp.getTime() > gapMs;
  const initial: {
    readonly current: ReadonlyArray<typeof StoredAnalyticsEvent.Type>;
    readonly sessions: ReadonlyArray<ReadonlyArray<typeof StoredAnalyticsEvent.Type>>;
  } = { current: [], sessions: [] };
  const { current, sessions } = Arr.reduce(
    Arr.sort(events, byTimestamp),
    initial,
    (state, event) =>
      Arr.match(state.current, {
        onEmpty: () => ({ current: [event], sessions: state.sessions }),
        onNonEmpty: (open) =>
          startsNewSession(Arr.lastNonEmpty(open), event)
            ? { current: [event], sessions: [...state.sessions, open] }
            : { current: [...open, event], sessions: state.sessions },
      }),
  );
  return Arr.isReadonlyArrayNonEmpty(current) ? [...sessions, current] : sessions;
};

const sessionNodes = (
  session: ReadonlyArray<typeof StoredAnalyticsEvent.Type>,
  definition: ExecutablePathsDefinition,
): ReadonlyArray<PathNode> => {
  const pathItem = definition.pathItem ?? "event_name";
  const allowed = definition.eventNames;
  const excluded = definition.excludeEventNames ?? [];
  const isVisible = (label: string) => {
    if (excluded.includes(label)) return false;
    if (Arr.isReadonlyArrayEmpty(allowed)) return true;
    return (
      allowed.includes(label) ||
      label === definition.startEventName ||
      label === definition.endEventName
    );
  };
  let nodes: ReadonlyArray<PathNode> = session.flatMap((event) =>
    Arr.fromOption(
      Option.map(Option.filter(pathItemLabel(event, pathItem), isVisible), (label) => ({
        label,
        timestamp: event.eventTimestamp,
      })),
    ),
  );

  if (definition.startEventName !== undefined) {
    const startIndex = nodes.findIndex((node) => node.label === definition.startEventName);
    if (startIndex < 0) return [];
    nodes = nodes.slice(startIndex);
  }
  if (definition.endEventName !== undefined) {
    const endIndex = nodes.findIndex(
      (node, index) => index > 0 && node.label === definition.endEventName,
    );
    if (endIndex < 0) return [];
    nodes = nodes.slice(0, endIndex + 1);
  }
  if (definition.collapseRepeated) {
    nodes = nodes.filter((node, index) => index === 0 || nodes[index - 1]?.label !== node.label);
  }
  return nodes.slice(0, definition.maxDepth);
};

const linkKey = (link: { source: string; sourceStep: number; target: string }) =>
  `${link.sourceStep} ${link.source} ${link.target}`;

const byLinkRank = Order.combine(
  Order.mapInput(Order.Number, (link: EventPathLink) => -link.count),
  Order.combine(
    Order.mapInput(Order.Number, (link: EventPathLink) => link.sourceStep),
    Order.combine(
      Order.mapInput(Order.String, (link: EventPathLink) => link.source),
      Order.mapInput(Order.String, (link: EventPathLink) => link.target),
    ),
  ),
);

/**
 * Builds path links from stored events for a validated paths definition.
 *
 * Events are grouped per actor, split into sessions, reduced to the nodes the
 * definition asks for (`event_name` or `screen_name`), and every consecutive
 * pair becomes a step-numbered link. Links are aggregated by
 * `(step, source, target)` with the mean transition time, filtered by the
 * density bounds and cut to `edgeLimit` by descending count.
 */
export const resolvePathsInsight = (input: {
  readonly definition: ExecutablePathsDefinition;
  readonly events: ReadonlyArray<typeof StoredAnalyticsEvent.Type>;
}): ReadonlyArray<EventPathLink> => {
  const { definition } = input;
  const sessionGapSeconds = definition.sessionGapSeconds ?? DEFAULT_SESSION_GAP_SECONDS;
  const edgeLimit = definition.edgeLimit ?? DEFAULT_EDGE_LIMIT;
  const filtered = Option.match(Option.fromNullishOr(definition.filters), {
    onNone: () => input.events,
    onSome: (filters) => input.events.filter((event) => matchesCustomFilter(event, filters)),
  });

  const byActor = Arr.reduce(
    filtered,
    HashMap.empty<string, Array<typeof StoredAnalyticsEvent.Type>>(),
    (all, event) =>
      Option.match(actorKey(event, definition.actor), {
        onNone: () => all,
        onSome: (key) =>
          HashMap.set(all, key, [
            ...Option.getOrElse(HashMap.get(all, key), () => []),
            event,
          ]),
      }),
  );

  const links = Arr.reduce(
    Arr.fromIterable(HashMap.values(byActor)),
    HashMap.empty<string, LinkAccumulator>(),
    (all, actorEvents) =>
      Arr.reduce(sessionize(actorEvents, sessionGapSeconds), all, (perSession, session) => {
        const nodes = sessionNodes(session, definition);
        return Arr.reduce(
          Arr.makeBy(Math.max(nodes.length - 1, 0), (index) => index),
          perSession,
          (acc, index) => {
            const source = nodes[index];
            const target = nodes[index + 1];
            if (source === undefined || target === undefined) return acc;
            const link = {
              source: source.label,
              sourceStep: index + 1,
              target: target.label,
              targetStep: index + 2,
            };
            const key = linkKey(link);
            const seconds = (target.timestamp.getTime() - source.timestamp.getTime()) / 1_000;
            const existing = HashMap.get(acc, key);
            return HashMap.set(acc, key, {
              ...link,
              count: Option.match(existing, { onNone: () => 1, onSome: (e) => e.count + 1 }),
              transitionSeconds: Option.match(existing, {
                onNone: () => seconds,
                onSome: (e) => e.transitionSeconds + seconds,
              }),
            });
          },
        );
      }),
  );

  const ranked = Arr.sort(
    Arr.fromIterable(HashMap.values(links)).map(
      (link): EventPathLink => ({
        averageTransitionSeconds: link.count === 0 ? 0 : link.transitionSeconds / link.count,
        count: link.count,
        source: link.source,
        sourceStep: link.sourceStep,
        target: link.target,
        targetStep: link.targetStep,
      }),
    ),
    byLinkRank,
  ).filter(
    (link) =>
      (definition.minEdgeCount === undefined || link.count >= definition.minEdgeCount) &&
      (definition.maxEdgeCount === undefined || link.count <= definition.maxEdgeCount),
  );

  return ranked.slice(0, edgeLimit);
};
