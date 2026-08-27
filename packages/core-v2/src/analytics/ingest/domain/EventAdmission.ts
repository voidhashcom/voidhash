/**
 * Event admission — the single rule deciding whether an inbound analytics event
 * name is stored, shared by every supported analytics configuration.
 *
 * The model is deliberately asymmetric:
 *
 * - **Built-in events** (`$`-prefixed, defined by {@link BUILTIN_EVENT_ADMISSION_LIST})
 *   are **default-deny**: the SDK emits them automatically and in volume, so the
 *   operator opts in per entry. The code default depends on the edition; the
 *   project's stored overrides win when present.
 * - **Custom events** (any non-`$` name) are **default-allow**: the developer
 *   explicitly chose to send them. A per-project blocklist exists only to turn a
 *   name off after the fact. There is no master toggle for the category.
 * - **Unknown `$`-prefixed names are rejected.** `$` is the reserved namespace,
 *   so a lookalike must never slip past a disabled built-in, and a newer SDK
 *   sending new reserved events to an older backend defaults to deny.
 *
 * Code owns the entries and their defaults, while persisted project policy
 * contains only explicit overrides. Absence means "use the default".
 */
import { constant, pick } from "@voidhash/lib/lang";
import { Schema } from "effect";

import { RESERVED_REVENUE_EVENT_NAMES } from "../../domain/InternalAnalyticsEvents.ts";

/** Which product edition an admission decision is being made for. */
export const AnalyticsEdition = Schema.Literals(["cloud", "oss"]);

/** Prefix marking the reserved (voidhash-defined) event namespace. */
export const RESERVED_EVENT_NAME_PREFIX = "$";

/**
 * One toggleable entry in the built-in event registry. An entry usually maps to
 * a single event name, but may cover a group of names that must move together
 * (see the `revenue` entry).
 */
export interface BuiltinEventAdmissionEntry {
  /** Stable wire key, persisted in the project's overrides and toggled in settings. */
  readonly key: string;
  /** Human-readable name shown in the project settings UI. */
  readonly name: string;
  /** Short explanation of what the entry admits, shown in settings. */
  readonly description: string;
  /** Every event name this entry admits. */
  readonly eventNames: readonly string[];
  /** The value used when the project has no explicit override, per edition. */
  readonly defaultEnabled: Readonly<Record<typeof AnalyticsEdition.Type, boolean>>;
  /** Rendered inline in settings when disabling the entry breaks a feature. */
  readonly warning?: string;
}

const lifecycleEntry = (
  eventName: string,
  name: string,
  description: string,
  defaultEnabled: Readonly<Record<typeof AnalyticsEdition.Type, boolean>>,
) =>
  ({
    key: eventName,
    name,
    description,
    eventNames: [eventName],
    defaultEnabled,
  }) satisfies BuiltinEventAdmissionEntry;

/** Key of the grouped entry covering every server-trusted revenue event. */
export const REVENUE_EVENT_ADMISSION_KEY = "revenue";

/**
 * The registry of admissible built-in events. Add an entry here to make a new
 * reserved event name storable; until then the name is rejected as unknown.
 *
 * Revenue is one grouped entry rather than 19 toggles on purpose: the built-in
 * revenue and churn metrics are derived from the whole set, so admitting a
 * subset would silently corrupt them.
 */
export const BUILTIN_EVENT_ADMISSION_LIST: readonly BuiltinEventAdmissionEntry[] = constant([
  lifecycleEntry(
    "$app_installed",
    "App installed",
    "First launch after a fresh install, used for install and acquisition counts.",
    { cloud: true, oss: true },
  ),
  lifecycleEntry("$app_updated", "App updated", "First launch after the app version changed.", {
    cloud: true,
    oss: false,
  }),
  lifecycleEntry("$app_opened", "App opened", "Every cold start of the app.", {
    cloud: true,
    oss: false,
  }),
  lifecycleEntry(
    "$app_backgrounded",
    "App backgrounded",
    "The app moved to the background. High volume on active installs.",
    { cloud: true, oss: false },
  ),
  lifecycleEntry(
    "$app_became_active",
    "App became active",
    "The app returned to the foreground. High volume on active installs.",
    { cloud: true, oss: false },
  ),
  lifecycleEntry("$sign_out", "Sign out", "The SDK's identity was reset by a sign-out.", {
    cloud: true,
    oss: false,
  }),
  {
    key: REVENUE_EVENT_ADMISSION_KEY,
    name: "Revenue",
    description:
      "Server-verified purchase and subscription events. All 19 revenue events move together.",
    eventNames: [...RESERVED_REVENUE_EVENT_NAMES],
    defaultEnabled: { cloud: true, oss: true },
    warning: "Disabling this stops all revenue, subscription, and churn reporting.",
  },
  {
    key: "$experiment.exposed",
    name: "Experiment exposure",
    description: "Emitted when a subject is assigned an experiment variant at serve time.",
    eventNames: ["$experiment.exposed"],
    defaultEnabled: { cloud: true, oss: false },
    warning: "Disabling this breaks A/B test results — experiments have no exposure data.",
  },
  {
    key: "$identify",
    name: "Identify",
    description: "Links an anonymous distinct id to a known user id.",
    eventNames: ["$identify"],
    defaultEnabled: { cloud: true, oss: false },
    warning: "Person-profile resolution requires a configured identity resolver.",
  },
]);

/** Registry entries indexed by the event names they admit. */
const entriesByEventName: ReadonlyMap<string, BuiltinEventAdmissionEntry> = new Map(
  BUILTIN_EVENT_ADMISSION_LIST.flatMap((entry) =>
    entry.eventNames.map(
      (eventName) => [eventName, entry] satisfies [string, BuiltinEventAdmissionEntry],
    ),
  ),
);

/** The registry entry admitting `eventName`, or `undefined` when it is not built in. */
export const builtinEntryForEventName = (
  eventName: string,
): BuiltinEventAdmissionEntry | undefined => entriesByEventName.get(eventName);

/** Whether a string is a known built-in admission key (i.e. a toggleable entry). */
export const isBuiltinEventAdmissionKey = (key: string): boolean =>
  BUILTIN_EVENT_ADMISSION_LIST.some((entry) => entry.key === key);

/** Whether an event name lives in the reserved (`$`-prefixed) namespace. */
export const isReservedEventName = (eventName: string): boolean =>
  eventName.startsWith(RESERVED_EVENT_NAME_PREFIX);

/**
 * The per-project admission configuration, read straight off the project's
 * capture policy row. Both fields are explicit overrides layered on top of the
 * registry defaults; a project with no policy row uses {@link emptyEventAdmissionPolicy}.
 */
export const EventAdmissionPolicy = Schema.Struct({
  /** Built-in admission key → explicit on/off. Absent keys fall back to the edition default. */
  builtinEventOverrides: Schema.Record(Schema.String, Schema.Boolean),
  /** Custom event names turned off after the fact. */
  customEventBlocklist: Schema.Array(Schema.String),
});

/** Admission policy for a project with no stored overrides: registry defaults only. */
export const emptyEventAdmissionPolicy: typeof EventAdmissionPolicy.Type = constant({
  builtinEventOverrides: {},
  customEventBlocklist: [],
});

/** Why an event name was refused admission. */
export type EventAdmissionRejectionReason =
  /** A known built-in whose entry is turned off for this project. */
  | "builtin_disabled"
  /** A custom name on the project's blocklist. */
  | "custom_blocked"
  /** A `$`-prefixed name with no registry entry. */
  | "unknown_reserved_event";

export type EventAdmissionDecision =
  | { readonly admitted: true }
  | { readonly admitted: false; readonly reason: EventAdmissionRejectionReason };

const ADMITTED: EventAdmissionDecision = constant({ admitted: true });

/** Whether a built-in entry is enabled for a project, applying override-then-default. */
export const isBuiltinEntryEnabled = ({
  edition,
  entry,
  policy,
}: {
  readonly edition: typeof AnalyticsEdition.Type;
  readonly entry: BuiltinEventAdmissionEntry;
  readonly policy: typeof EventAdmissionPolicy.Type;
}): boolean => policy.builtinEventOverrides[entry.key] ?? entry.defaultEnabled[edition];

/**
 * The single admission rule enforced on every ingest path in both editions.
 * Pure: callers supply the project's policy and the edition whose defaults
 * apply, and get back an accept/reject decision with a machine-readable reason.
 */
export const admitEvent = ({
  edition,
  eventName,
  policy,
}: {
  readonly edition: typeof AnalyticsEdition.Type;
  readonly eventName: string;
  readonly policy: typeof EventAdmissionPolicy.Type;
}): EventAdmissionDecision => {
  const entry = builtinEntryForEventName(eventName);
  if (entry) {
    return pick(isBuiltinEntryEnabled({ edition, entry, policy }), ADMITTED, {
      admitted: false,
      reason: "builtin_disabled",
    });
  }
  if (isReservedEventName(eventName)) {
    return { admitted: false, reason: "unknown_reserved_event" };
  }
  return pick(
    policy.customEventBlocklist.includes(eventName),
    {
      admitted: false,
      reason: "custom_blocked",
    },
    ADMITTED,
  );
};

/** Boolean shorthand over {@link admitEvent} for hot-path filters. */
export const isEventAdmitted = (input: {
  readonly edition: typeof AnalyticsEdition.Type;
  readonly eventName: string;
  readonly policy: typeof EventAdmissionPolicy.Type;
}): boolean => admitEvent(input).admitted;

/** One built-in entry resolved against a project's overrides, for the settings UI. */
export interface ResolvedBuiltinEventAdmission {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly eventNames: readonly string[];
  readonly warning: string | null;
  /** The edition's code default for this entry. */
  readonly defaultEnabled: boolean;
  /** The project's explicit override, or `null` when falling back to the default. */
  readonly override: boolean | null;
  /** The effective state: `override ?? defaultEnabled`. */
  readonly enabled: boolean;
}

/**
 * Resolve the full registry against a project's overrides for the given
 * edition. Stale override keys no longer in the registry are ignored.
 */
export const resolveBuiltinEventAdmissionList = ({
  edition,
  policy,
}: {
  readonly edition: typeof AnalyticsEdition.Type;
  readonly policy: typeof EventAdmissionPolicy.Type;
}): ResolvedBuiltinEventAdmission[] =>
  BUILTIN_EVENT_ADMISSION_LIST.map((entry) => {
    const stored = policy.builtinEventOverrides[entry.key];
    const override = stored ?? null;
    const defaultEnabled = entry.defaultEnabled[edition];
    return {
      key: entry.key,
      name: entry.name,
      description: entry.description,
      eventNames: entry.eventNames,
      warning: entry.warning ?? null,
      defaultEnabled,
      override,
      enabled: override ?? defaultEnabled,
    };
  });

/**
 * Normalize a custom event name supplied by the settings UI. Rejects reserved
 * names (they are governed by the registry, not the blocklist) and blanks.
 */
export const normalizeCustomEventName = (eventName: string): string | undefined => {
  const trimmed = eventName.trim();
  if (!trimmed || isReservedEventName(trimmed)) return undefined;
  return trimmed;
};
