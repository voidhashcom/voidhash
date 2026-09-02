import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";
import type { PushNotificationSendType } from "@voidhash/rpc";
import {
  Badge,
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
import { XIcon } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/features/studio/components/auth-context";
import { RelativeTime } from "@/features/studio/components/relative-time";
import {
  getPushNotificationSendDeliveriesOptions,
  listPushNotificationSendsOptions,
} from "@/features/studio/lib/tanstack-query";
import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

const SENDS_PAGE_SIZE = 100;

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/activity/sent-notifications",
)({
  component: SentNotificationsPage,
});

function SentNotificationsPage() {
  const { organizationSlug, projectSlug } = Route.useParams();
  // Gated behind an internal feature flag (unreleased) — also hides direct URL access.
  const enabled = useInternalFeatureFlag(INTERNAL_FEATURE_FLAGS.notifications.key);
  const { user } = useAuth();

  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  if (!enabled) {
    return (
      <VoidhashErrorCard
        error={{
          code: "NOT_FOUND",
          message: "This page is not available.",
          title: "Page not found",
        }}
      />
    );
  }

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

  return <SentNotificationsContent projectId={project.id} />;
}

// Split from the flag/project gate above so the data hooks live in a component
// that only mounts once both checks pass. This keeps the hook order stable even
// if the `notifications` flag flips (or the CurrentUser query refetches) while
// the route stays mounted — otherwise the extra `useQuery` would change the hook
// count between renders and crash the page (Rules of Hooks).
function SentNotificationsContent({ projectId }: { projectId: string }) {
  const [visibleCount, setVisibleCount] = useState(SENDS_PAGE_SIZE);
  const [selectedSendId, setSelectedSendId] = useState<string | null>(null);

  const sendsQuery = useQuery(
    listPushNotificationSendsOptions({
      limit: visibleCount,
      projectId,
    }),
  );

  if (sendsQuery.status === "pending") {
    return <SentNotificationsPageSkeleton />;
  }

  if (sendsQuery.status === "error") {
    return (
      <VoidhashErrorCard
        error={{
          code: "INTERNAL_SERVER_ERROR",
          message: "An error occurred loading sent notifications.",
        }}
      />
    );
  }

  const { hasMore, sends } = sendsQuery.data;
  const selectedSend =
    selectedSendId === null ? null : (sends.find((send) => send.id === selectedSendId) ?? null);

  return (
    <Page className="flex h-[calc(100svh-var(--header-height))] flex-row overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <SentNotificationsHeader />

        <div className="min-w-0 flex-1 px-4 pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Send ID</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Devices</TableHead>
                <TableHead className="text-right">Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sends.length > 0 ? (
                sends.map((send) => (
                  <SendRow
                    isSelected={send.id === selectedSendId}
                    key={send.id}
                    onSelect={setSelectedSendId}
                    send={send}
                  />
                ))
              ) : (
                <TableRow>
                  <TableCell className="h-24 text-center" colSpan={6}>
                    No notifications have been sent yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {hasMore ? (
            <div className="mt-3">
              <Button
                className="w-full"
                disabled={sendsQuery.isFetching}
                onClick={() => {
                  setVisibleCount((count) => count + SENDS_PAGE_SIZE);
                }}
                variant="outline"
              >
                {sendsQuery.isFetching ? "Loading..." : "Show more"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {selectedSend ? (
        <SendDetailsPanel
          onClose={() => setSelectedSendId(null)}
          projectId={projectId}
          send={selectedSend}
        />
      ) : null}
    </Page>
  );
}

function SentNotificationsHeader() {
  return (
    <PageHeader>
      <PageHeaderTitle>Sent notifications</PageHeaderTitle>
    </PageHeader>
  );
}

interface SendRowProps {
  send: PushNotificationSendType;
  isSelected: boolean;
  onSelect: (sendId: string) => void;
}

function SendRow({ send, isSelected, onSelect }: SendRowProps) {
  return (
    <TableRow
      aria-selected={isSelected}
      className={cn("cursor-pointer", isSelected && "shadow-[inset_2px_0_0_0_var(--primary)]")}
      data-state={isSelected ? "selected" : undefined}
      onClick={() => onSelect(send.id)}
    >
      <TableCell>
        <SendStatusBadge status={send.status} />
      </TableCell>
      <TableCell className="font-mono text-muted-foreground text-xs">{send.id}</TableCell>
      <TableCell className="text-right text-sm">{send.succeededCount}</TableCell>
      <TableCell className={cn("text-right text-sm", send.failedCount > 0 && "text-destructive")}>
        {send.failedCount}
      </TableCell>
      <TableCell className="text-right text-muted-foreground text-sm">{send.deviceCount}</TableCell>
      <TableCell className="text-right">
        <RelativeTime value={send.createdAt} />
      </TableCell>
    </TableRow>
  );
}

interface SendDetailsPanelProps {
  send: PushNotificationSendType;
  projectId: string;
  onClose: () => void;
}

function SendDetailsPanel({ send, projectId, onClose }: SendDetailsPanelProps) {
  return (
    <aside className="flex h-full w-[420px] shrink-0 flex-col border-l border-border/60 bg-background">
      <PageHeader
        className="pr-2"
        rightActions={
          <Button aria-label="Close send details" onClick={onClose} size="icon-sm" variant="ghost">
            <XIcon className="size-3.5" />
          </Button>
        }
      >
        <PageHeaderTitle>Notification send</PageHeaderTitle>
      </PageHeader>

      <ScrollArea className="min-h-0 flex-1">
        <Section title="Send">
          <dl className="divide-y divide-border/60">
            <DetailField label="Send ID" mono value={send.id} />
            <DetailField label="Status" value={<SendStatusBadge status={send.status} />} />
            <DetailField label="Devices targeted" mono value={String(send.deviceCount)} />
            <DetailField label="Delivered" mono value={String(send.succeededCount)} />
            <DetailField label="Failed" mono value={String(send.failedCount)} />
            <DetailField label="Skipped" mono value={String(send.skippedCount)} />
            <DetailField label="Requested persons" mono value={String(send.requestedPersonCount)} />
            <DetailField
              label="Requested distinct IDs"
              mono
              value={String(send.requestedDistinctIdCount)}
            />
            <DetailField
              label="Unresolved distinct IDs"
              value={
                send.unresolvedDistinctIds.length > 0 ? (
                  <span className="font-mono text-xs">{send.unresolvedDistinctIds.join(", ")}</span>
                ) : (
                  <NullValue />
                )
              }
            />
            <DetailField
              label="Idempotency key"
              mono
              value={send.idempotencyKey ?? <NullValue />}
            />
            <DetailField label="Created at" mono value={formatDateTime(send.createdAt)} />
            <DetailField
              label="Completed at"
              mono
              value={send.completedAt ? formatDateTime(send.completedAt) : <NullValue />}
            />
          </dl>
        </Section>

        <Section title="Message">
          {send.isMessagePurged ? (
            <div className="px-4 py-2 text-muted-foreground/70 text-xs">
              The message payload has been purged.
            </div>
          ) : (
            <pre className="overflow-x-auto px-4 py-2 font-mono text-[11px] text-foreground">
              {JSON.stringify(send.message, null, 2)}
            </pre>
          )}
        </Section>

        <Section title="Deliveries">
          <DeliveriesTable projectId={projectId} sendId={send.id} />
        </Section>
      </ScrollArea>
    </aside>
  );
}

function DeliveriesTable({ projectId, sendId }: { projectId: string; sendId: string }) {
  const query = useQuery(getPushNotificationSendDeliveriesOptions({ projectId, sendId }));

  if (query.status === "pending") {
    return (
      <div className="space-y-2 px-4 py-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton className="h-4 w-full" key={`delivery-skeleton-${index}`} />
        ))}
      </div>
    );
  }

  if (query.status === "error") {
    return <div className="px-4 py-2 text-destructive text-xs">Failed to load deliveries.</div>;
  }

  const { deliveries } = query.data;
  if (deliveries.length === 0) {
    return <div className="px-4 py-2 text-muted-foreground/70 text-xs">No deliveries.</div>;
  }

  return (
    <div className="px-1">
      {deliveries.map((delivery) => (
        <div className="border-border/60 border-b px-3 py-2 last:border-b-0" key={delivery.id}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] text-muted-foreground uppercase">
              {delivery.provider}
            </span>
            <DeliveryStatusBadge status={delivery.status} />
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Attempt {delivery.attemptCount}/{delivery.maxAttempts}
            {delivery.providerMessageId ? (
              <span className="ml-2 font-mono">{delivery.providerMessageId}</span>
            ) : null}
          </div>
          {delivery.lastError ? (
            <div className="mt-1 break-all text-[11px] text-destructive">{delivery.lastError}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Badge variant for a send-level status label from the RPC. */
function SendStatusBadge({ status }: { status: string }) {
  const variant =
    status === "succeeded"
      ? "default"
      : status === "failed" || status === "partial_failed"
        ? "destructive"
        : status === "no_recipients"
          ? "outline"
          : "secondary";
  return <Badge variant={variant}>{humanizeStatus(status)}</Badge>;
}

/** Badge variant for a per-device delivery status label from the RPC. */
function DeliveryStatusBadge({ status }: { status: string }) {
  const variant =
    status === "succeeded"
      ? "default"
      : status === "failed" || status === "exhausted"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant}>{humanizeStatus(status)}</Badge>;
}

function humanizeStatus(status: string): string {
  return status.replace(/_/g, " ");
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
        <span>{title}</span>
      </button>
      {isExpanded ? <div className="pb-2">{children}</div> : null}
    </div>
  );
}

function SentNotificationsPageSkeleton() {
  return (
    <Page className="flex h-[calc(100svh-var(--header-height))] flex-row overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <SentNotificationsHeader />
        <div className="min-w-0 flex-1 px-4 pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Send ID</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Devices</TableHead>
                <TableHead className="text-right">Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 8 }).map((_, index) => (
                <TableRow key={`sent-notifications-skeleton-${index}`}>
                  <TableCell>
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-8" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-8" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-8" />
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
