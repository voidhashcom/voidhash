import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Button,
  cn,
  Page,
  PageHeader,
  PageHeaderTitle,
  ScrollArea,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voidhash/ui";
import { format } from "date-fns";
import { ChevronRightIcon, XIcon } from "lucide-react";
import { useState } from "react";
import type { RecentAnalyticsEventType } from "@voidhash/rpc";
import { useAuth } from "@/features/studio/components/auth-context";
import { RelativeTime } from "@/features/studio/components/relative-time";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { listRecentAnalyticsEventsOptions } from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

const EVENTS_PAGE_SIZE = 100;

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/activity/events",
)({
  component: EventsPage,
});

function EventsPage() {
  const { organizationSlug, projectSlug } = Route.useParams();
  const { user } = useAuth();
  const [visibleCount, setVisibleCount] = useState(EVENTS_PAGE_SIZE);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  if (!project) {
    return (
      <VoidhashErrorCard
        error={{
          code: "INTERNAL_SERVER_ERROR",
          message: "The project you are looking for does not exist.",
          title: "Project not found",
        }}
      />
    );
  }

  const recentEventsQuery = useQuery(
    listRecentAnalyticsEventsOptions({
      limit: visibleCount,
      projectId: project.id,
    }),
  );

  if (recentEventsQuery.status === "pending") {
    return <EventsPageSkeleton />;
  }

  if (recentEventsQuery.status === "error") {
    return (
      <VoidhashErrorCard
        error={{
          code: "INTERNAL_SERVER_ERROR",
          message: "An error occurred loading recent analytics events.",
        }}
      />
    );
  }

  const { events, hasMore } = recentEventsQuery.data;
  const selectedEvent =
    selectedEventId === null
      ? null
      : (events.find((event) => event.eventId === selectedEventId) ?? null);

  return (
    <Page className="flex h-[calc(100svh-var(--header-height))] flex-row overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <EventsHeader />

        <div className="min-w-0 flex-1 px-4 pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event name</TableHead>
                <TableHead>Event ID</TableHead>
                <TableHead>Person</TableHead>
                <TableHead className="text-right">Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length > 0 ? (
                events.map((event) => (
                  <EventRow
                    event={event}
                    isSelected={event.eventId === selectedEventId}
                    key={event.eventId}
                    onSelect={setSelectedEventId}
                    organizationSlug={organizationSlug as string}
                    projectSlug={projectSlug as string}
                  />
                ))
              ) : (
                <TableRow>
                  <TableCell className="h-24 text-center" colSpan={4}>
                    No analytics events have been received yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {hasMore ? (
            <div className="mt-3">
              <Button
                className="w-full"
                disabled={recentEventsQuery.isFetching}
                onClick={() => {
                  setVisibleCount((count) => count + EVENTS_PAGE_SIZE);
                }}
                variant="outline"
              >
                {recentEventsQuery.isFetching ? "Loading..." : "Show more"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {selectedEvent ? (
        <EventDetailsPanel
          event={selectedEvent}
          onClose={() => setSelectedEventId(null)}
          organizationSlug={organizationSlug as string}
          projectSlug={projectSlug as string}
        />
      ) : null}
    </Page>
  );
}

function EventsHeader() {
  return (
    <PageHeader>
      <PageHeaderTitle>Analytics events</PageHeaderTitle>
    </PageHeader>
  );
}

interface EventRowProps {
  event: RecentAnalyticsEventType;
  isSelected: boolean;
  onSelect: (eventId: string) => void;
  organizationSlug: string;
  projectSlug: string;
}

function EventRow({ event, isSelected, onSelect, organizationSlug, projectSlug }: EventRowProps) {
  return (
    <TableRow
      aria-selected={isSelected}
      className={cn(
        "cursor-pointer",
        // Inset box-shadow mimics the lensflare LogRow's `border-l-2` accent
        // indicator. We use box-shadow instead of border-left because
        // `<tr>` borders are unreliable under `border-collapse: collapse`.
        isSelected && "shadow-[inset_2px_0_0_0_var(--primary)]",
      )}
      data-state={isSelected ? "selected" : undefined}
      onClick={() => onSelect(event.eventId)}
    >
      <TableCell className="font-medium text-sm">{event.eventName}</TableCell>
      <TableCell className="font-mono text-muted-foreground text-xs">{event.eventId}</TableCell>
      <TableCell>{renderPersonCell(event, organizationSlug, projectSlug)}</TableCell>
      <TableCell className="text-right">
        <RelativeTime value={event.receivedAt} />
      </TableCell>
    </TableRow>
  );
}

interface EventDetailsPanelProps {
  event: RecentAnalyticsEventType;
  onClose: () => void;
  organizationSlug: string;
  projectSlug: string;
}

function EventDetailsPanel({
  event,
  onClose,
  organizationSlug,
  projectSlug,
}: EventDetailsPanelProps) {
  const personLabel =
    event.personName ??
    event.personEmail ??
    event.personDistinctId ??
    event.personId ??
    "Unknown person";

  return (
    <aside className="flex h-full w-[420px] shrink-0 flex-col border-l border-border/60 bg-background">
      <PageHeader
        className="pr-2"
        rightActions={
          <Button aria-label="Close event details" onClick={onClose} size="icon-sm" variant="ghost">
            <XIcon className="size-3.5" />
          </Button>
        }
      >
        <PageHeaderTitle>{event.eventName}</PageHeaderTitle>
      </PageHeader>

      <ScrollArea className="min-h-0 flex-1">
        <Section title="Event">
          <dl className="divide-y divide-border/60">
            <DetailField label="Event name" value={event.eventName} />
            <DetailField label="Event ID" mono value={event.eventId} />
            <DetailField label="Capture ID" mono value={event.captureId} />
            <DetailField label="Request ID" mono value={event.requestId} />
            <DetailField label="Event time" mono value={formatDateTime(event.timestamp)} />
            <DetailField label="Received at" mono value={formatDateTime(event.receivedAt)} />
            <DetailField label="Processed at" mono value={formatDateTime(event.processedAt)} />
            <DetailField
              label="Person"
              value={
                event.personDistinctId ? (
                  <Link
                    className="text-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground/80"
                    onClick={(clickEvent) => clickEvent.stopPropagation()}
                    params={{
                      id: event.personDistinctId,
                      organizationSlug,
                      projectSlug,
                    }}
                    to="/studio/$organizationSlug/$projectSlug/persons/$id"
                  >
                    {personLabel}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{personLabel}</span>
                )
              }
            />
            <DetailField label="Person name" value={event.personName ?? <NullValue />} />
            <DetailField label="Person email" value={event.personEmail ?? <NullValue />} />
            <DetailField label="Distinct ID" mono value={event.personDistinctId ?? <NullValue />} />
            <DetailField label="Person ID" mono value={event.personId ?? <NullValue />} />
            <DetailField
              label="Previous distinct ID"
              mono
              value={event.previousDistinctId ?? <NullValue />}
            />
            <DetailField label="Identity mode" mono value={event.identityMode} />
          </dl>
        </Section>

        <Section title="Properties">
          <PropertyTree data={event.properties} />
        </Section>

        <Section title="Context">
          <PropertyTree data={event.context} />
        </Section>
      </ScrollArea>
    </aside>
  );
}

interface DetailFieldProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

function DetailField({ label, value, mono = false }: DetailFieldProps) {
  return (
    <div className="px-4 py-3">
      <dt className="text-[11px] text-muted-foreground/70 uppercase tracking-wide">{label}</dt>
      <dd className={cn("mt-1 break-all text-foreground text-sm", mono && "font-mono text-xs")}>
        {value}
      </dd>
    </div>
  );
}

function NullValue() {
  return <span className="text-muted-foreground/50">—</span>;
}

function formatDateTime(date: Date) {
  return format(date, "yyyy-MM-dd HH:mm:ss.SSS");
}

function Section({
  title,
  defaultExpanded = true,
  children,
}: {
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  return (
    <div className="border-border/60 border-b last:border-b-0">
      <button
        className="flex w-full items-center gap-1.5 px-4 py-2 text-[11px] text-muted-foreground/70 uppercase tracking-wide transition-colors hover:text-foreground"
        onClick={() => setIsExpanded((v) => !v)}
        type="button"
      >
        <ChevronRightIcon
          className={cn("size-3 transition-transform", isExpanded && "rotate-90")}
        />
        <span>{title}</span>
      </button>
      {isExpanded ? <div className="pb-2">{children}</div> : null}
    </div>
  );
}

function PropertyTree({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <div className="px-4 py-2 text-muted-foreground/70 text-xs">No data</div>;
  }
  return (
    <div className="px-3 font-mono text-[11px]">
      {entries.map(([key, value]) => (
        <PropertyRow key={key} name={key} value={value} />
      ))}
    </div>
  );
}

function PropertyRow({ name, value }: { name: string; value: unknown }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isObject = typeof value === "object" && value !== null && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const canExpand = isObject || isArray;

  return (
    <div>
      <div
        className={cn(
          "flex items-start gap-1 py-0.5",
          canExpand && "-mx-1 cursor-pointer rounded-sm px-1 hover:bg-accent/30",
        )}
        onClick={canExpand ? () => setIsExpanded((v) => !v) : undefined}
      >
        {canExpand ? (
          <ChevronRightIcon
            className={cn(
              "mt-[3px] size-3 shrink-0 text-muted-foreground transition-transform",
              isExpanded && "rotate-90",
            )}
          />
        ) : (
          <span className="mt-[3px] size-3 shrink-0" />
        )}
        <span className="shrink-0 text-foreground/70">{name}</span>
        <span className="text-muted-foreground">:</span>
        <span className="min-w-0 flex-1 break-all text-foreground">{formatValue(value)}</span>
      </div>
      {canExpand && isExpanded ? (
        <div className="ml-3 border-border/60 border-l pl-2">
          {isArray
            ? (value as unknown[]).map((entry, index) => (
                <PropertyRow key={index} name={String(index)} value={entry} />
              ))
            : Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                <PropertyRow key={k} name={k} value={v} />
              ))}
        </div>
      ) : null}
    </div>
  );
}

function formatValue(value: unknown): React.ReactNode {
  if (value === undefined) return <NullValue />;
  if (value === null) return <span className="text-muted-foreground/60">null</span>;
  if (Array.isArray(value)) {
    return <span className="text-muted-foreground/60">Array({value.length})</span>;
  }
  if (typeof value === "string") return <span>{value}</span>;
  if (typeof value === "boolean" || typeof value === "number" || typeof value === "bigint") {
    return <span>{String(value)}</span>;
  }
  if (typeof value === "symbol" || typeof value === "function") {
    return <span>{value.toString()}</span>;
  }
  return (
    <span className="text-muted-foreground/60">Object({Object.keys(value as object).length})</span>
  );
}

function renderPersonCell(
  event: {
    personDistinctId: string | null;
    personEmail: string | null;
    personId: string | null;
    personName: string | null;
  },
  organizationSlug: string,
  projectSlug: string,
) {
  const label =
    event.personName ??
    event.personEmail ??
    event.personDistinctId ??
    event.personId ??
    "Unknown person";

  if (!event.personDistinctId) {
    return <span className="text-muted-foreground text-sm">{label}</span>;
  }

  return (
    <Link
      className="text-foreground text-sm underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground/80"
      onClick={(clickEvent) => clickEvent.stopPropagation()}
      params={{
        id: event.personDistinctId,
        organizationSlug,
        projectSlug,
      }}
      to="/studio/$organizationSlug/$projectSlug/persons/$id"
    >
      {label}
    </Link>
  );
}

function EventsPageSkeleton() {
  return (
    <Page className="flex h-[calc(100svh-var(--header-height))] flex-row overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <EventsHeader />
        <div className="min-w-0 flex-1 px-4 pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event name</TableHead>
                <TableHead>Event ID</TableHead>
                <TableHead>Person</TableHead>
                <TableHead className="text-right">Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 8 }).map((_, index) => (
                <TableRow key={`events-skeleton-${index}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <Skeleton className="h-4 w-56" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-20" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </Page>
  );
}
