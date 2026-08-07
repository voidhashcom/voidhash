import type { PaywallOutboundEnvelope } from "@voidhash/paywalls";
import { Schema } from "effect";
import type { ReactNode } from "react";

import { cn } from "../lib/cn";
import type { ComponentEntry, InvalidEntry, PaywallEntry } from "../voidhash/paywalls";
import type { PreviewDeviceProfile } from "../voidhash/preview-devices";
import type { PreviewEvent } from "../voidhash/preview-runtime";
import { ComponentPreview } from "./ComponentPreview";

/** Renders an arbitrary event payload as a JSON string for the event log. */
const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

const SectionLabel = ({ children }: { children: ReactNode }): ReactNode => (
  <div className="px-4 pt-4 pb-1 font-semibold text-[11px] text-neutral-500 uppercase tracking-wider">
    {children}
  </div>
);

/** A one-line summary of an envelope's payload, or null when it has none. */
const envelopeDetail = (envelope: PaywallOutboundEnvelope): string | null => {
  switch (envelope.type) {
    case "ready":
      return envelope.payload?.templateVersion ?? null;
    case "close":
      return envelope.payload?.reason ?? null;
    case "purchase":
      return envelope.payload.productId;
    case "restore":
      return envelope.payload?.source ?? null;
    case "openExternal":
      return envelope.payload.url;
    case "event": {
      const { name, properties } = envelope.payload;
      if (!properties) return name;
      return `${name} ${encodeJson(properties)}`;
    }
    case "log":
      return `${envelope.payload.level}: ${envelope.payload.message}`;
    default:
      return null;
  }
};

/** A component's static preview, or a hint when the file exports no definition. */
const ComponentBody = ({
  entry,
  profile,
}: {
  entry: ComponentEntry;
  profile: PreviewDeviceProfile;
}): ReactNode => {
  if (!entry.definition) {
    return (
      <p className="px-2.5 pb-2 text-[11px] text-neutral-600">
        No <code>defineComponent(...)</code> export found.
      </p>
    );
  }
  return (
    <div className="px-2 pb-2">
      <ComponentPreview definition={entry.definition} profile={profile} />
    </div>
  );
};

/** The live log of bridge envelopes, newest first. */
const EventLog = ({ events }: { events: ReadonlyArray<PreviewEvent> }): ReactNode => {
  if (events.length === 0) {
    return (
      <p className="px-1 py-2 text-[11px] text-neutral-600">
        Envelopes posted by the paywall (ready, purchase, …) show up here.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {events
        .slice()
        .reverse()
        .map((event) => {
          const detail = envelopeDetail(event.envelope);
          return (
            <li
              className="flex items-baseline gap-2 rounded bg-neutral-900 px-2 py-1 font-mono text-[11px]"
              key={event.key}
            >
              <span className="shrink-0 text-emerald-300">{event.envelope.type}</span>
              {detail && (
                <span className="truncate text-neutral-400" title={detail}>
                  {detail}
                </span>
              )}
            </li>
          );
        })}
    </ul>
  );
};

export interface SidebarProps {
  paywalls: ReadonlyArray<PaywallEntry>;
  components: ReadonlyArray<ComponentEntry>;
  invalid: ReadonlyArray<InvalidEntry>;
  events: ReadonlyArray<PreviewEvent>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClearEvents: () => void;
  profile: PreviewDeviceProfile;
}

/**
 * The right-hand panel: the list of paywalls (primary navigation), any invalid
 * files, the project's reusable components (with a best-effort static
 * preview each), and a live log of the bridge envelopes the previewed paywall
 * posts.
 */
export const Sidebar = ({
  paywalls,
  components,
  invalid,
  events,
  selectedId,
  onSelect,
  onClearEvents,
  profile,
}: SidebarProps): ReactNode => (
  <aside className="flex h-full w-80 flex-col border-neutral-800 border-l bg-neutral-950">
    <div className="flex items-center justify-between px-4 pt-4 pb-2">
      <h2 className="font-semibold text-neutral-100 text-sm">Paywalls</h2>
      <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-400">
        {paywalls.length}
      </span>
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-0.5 px-2">
        {paywalls.length === 0 && (
          <p className="px-2 py-4 text-neutral-500 text-xs">
            No paywalls found in <code>.voidhash/paywalls</code>.
          </p>
        )}
        {paywalls.map((p) => (
          <button
            className={cn(
              "flex flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left transition-colors",
              p.id === selectedId && "bg-emerald-600/15 text-emerald-300 ring-1 ring-emerald-600/40",
              p.id !== selectedId && "text-neutral-300 hover:bg-neutral-900",
            )}
            key={p.id}
            onClick={() => onSelect(p.id)}
            type="button"
          >
            <span className="font-medium text-sm">{p.title}</span>
            <span className="text-[11px] text-neutral-500">{p.id}</span>
          </button>
        ))}
      </div>

      {invalid.length > 0 && (
        <>
          <SectionLabel>Needs attention</SectionLabel>
          <div className="flex flex-col gap-1 px-3">
            {invalid.map((entry) => (
              <div
                className="rounded-md border border-amber-700/40 bg-amber-950/30 px-3 py-2"
                key={entry.id}
              >
                <p className="font-medium text-amber-300 text-xs">{entry.id}</p>
                <p className="mt-0.5 text-[11px] text-amber-500/80">{entry.reason}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {components.length > 0 && (
        <>
          <SectionLabel>Components</SectionLabel>
          <div className="flex flex-col gap-2 px-3 pb-2">
            {components.map((c) => (
              <div className="rounded-md border border-neutral-800 bg-neutral-900/40" key={c.id}>
                <div className="flex items-baseline justify-between px-2.5 pt-2 pb-1">
                  <span className="font-medium text-neutral-300 text-xs">
                    {c.definition?.title ?? c.id}
                  </span>
                  {c.manifest && (
                    <span className="text-[11px] text-neutral-600">
                      {Object.keys(c.manifest.props).length} props
                    </span>
                  )}
                </div>
                <ComponentBody entry={c} profile={profile} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>

    <div className="border-neutral-800 border-t">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="font-semibold text-[11px] text-neutral-500 uppercase tracking-wider">
          Events
        </span>
        {events.length > 0 && (
          <button
            className="text-[11px] text-neutral-500 hover:text-neutral-300"
            onClick={onClearEvents}
            type="button"
          >
            clear
          </button>
        )}
      </div>
      <div className="max-h-40 overflow-y-auto px-3 pb-3">
        <EventLog events={events} />
      </div>
    </div>
  </aside>
);
