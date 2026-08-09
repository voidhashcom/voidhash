import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Button,
  Input,
  Page,
  PageHeader,
  PageHeaderTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@voidhash/ui";
import { INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";
import { Save, Trash2 } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/features/studio/components/auth-context";
import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";
import {
  deleteVoidQlInsightOptions,
  listVoidQlInsightsOptions,
  queryKeys,
  runVoidQlQueryOptions,
  saveVoidQlInsightOptions,
} from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/analytics/query",
)({
  component: QueryPage,
});

const EXAMPLE_QUERY =
  "SELECT event_name, count() AS n\nFROM events\nGROUP BY event_name\nORDER BY n DESC\nLIMIT 100";

/** Render an arbitrary VoidQL result cell value as display text. */
function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "symbol" || typeof value === "function") return value.toString();
  return JSON.stringify(value);
}

/** Best-effort extraction of a human-readable message from a typed RPC error. */
function errorMessage(error: unknown): { message: string; hint?: string } {
  if (typeof error === "object" && error !== null) {
    const message = Reflect.get(error, "message");
    const hint = Reflect.get(error, "hint");
    return {
      message: typeof message === "string" ? message : "The query could not be executed.",
      hint: typeof hint === "string" && hint.length > 0 ? hint : undefined,
    };
  }
  return { message: "The query could not be executed." };
}

function QueryPage() {
  const { organizationSlug, projectSlug } = Route.useParams();
  const { user } = useAuth();
  // Gated behind an internal feature flag (unreleased) — also hides direct URL access.
  const queryEnabled = useInternalFeatureFlag(INTERNAL_FEATURE_FLAGS.voidqlQuery.key);
  const [text, setText] = useState(EXAMPLE_QUERY);
  const [name, setName] = useState("Untitled query");
  const queryClient = useQueryClient();

  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  const runQuery = useMutation(runVoidQlQueryOptions());
  const saveQuery = useMutation(saveVoidQlInsightOptions());
  const deleteQuery = useMutation(deleteVoidQlInsightOptions());
  const savedQueries = useQuery({
    ...listVoidQlInsightsOptions({ organizationId: project?.organizationId ?? "missing-org" }),
    enabled: project !== undefined && queryEnabled,
  });

  if (!queryEnabled) {
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

  const onRun = () => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    runQuery.mutate({ organizationId: project.organizationId, text: trimmed });
  };

  const result = runQuery.data;
  const error = runQuery.isError ? errorMessage(runQuery.error) : null;
  const refreshSaved = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.analytics.voidQlInsights({ organizationId: project.organizationId }),
    });

  return (
    <Page className="flex h-[calc(100svh-var(--header-height))] flex-col overflow-hidden">
      <PageHeader>
        <PageHeaderTitle>Query</PageHeaderTitle>
      </PageHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-8">
        <div className="flex flex-col gap-2">
          <Textarea
            aria-label="VoidQL query"
            className="min-h-32 font-mono text-sm"
            onChange={(event) => setText(event.target.value)}
            placeholder="SELECT event_name, count() AS n FROM events GROUP BY event_name"
            spellCheck={false}
            value={text}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={runQuery.isPending || text.trim().length === 0} onClick={onRun}>
              {runQuery.isPending ? "Running…" : "Run"}
            </Button>
            {result ? (
              <span className="text-muted-foreground text-sm">
                {result.rows.length} row{result.rows.length === 1 ? "" : "s"}
              </span>
            ) : null}
            <Input
              aria-label="Saved query name"
              className="ml-auto max-w-64"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
            <Button
              disabled={!name.trim() || !text.trim() || saveQuery.isPending}
              onClick={() =>
                saveQuery.mutate(
                  { name: name.trim(), organizationId: project.organizationId, text: text.trim() },
                  { onSuccess: () => void refreshSaved() },
                )
              }
              variant="outline"
            >
              <Save /> {saveQuery.isPending ? "Saving…" : "Save query"}
            </Button>
          </div>
        </div>

        {savedQueries.data?.insights.length ? (
          <div className="flex flex-wrap gap-2 rounded-md border p-3">
            {savedQueries.data.insights.map((insight) => (
              <div className="flex items-center rounded-md border bg-background" key={insight.id}>
                <button
                  className="px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setName(insight.name);
                    setText(insight.text);
                  }}
                  type="button"
                >
                  {insight.name}
                </button>
                <Button
                  aria-label={`Delete ${insight.name}`}
                  onClick={() =>
                    deleteQuery.mutate({ id: insight.id }, { onSuccess: () => void refreshSaved() })
                  }
                  size="icon"
                  variant="ghost"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive text-sm">
            <p className="font-medium">{error.message}</p>
            {error.hint ? <p className="mt-1 text-destructive/80">{error.hint}</p> : null}
          </div>
        ) : null}

        {result ? (
          <div className="min-w-0 overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {result.columns.map((column) => (
                    <TableHead key={column.name}>{column.name}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.length > 0 ? (
                  result.rows.map((row, rowIndex) => (
                    // Result rows have no stable id; index is acceptable for a read-only view.
                    <TableRow key={rowIndex}>
                      {result.columns.map((column) => (
                        <TableCell className="font-mono text-xs" key={column.name}>
                          {formatCell(row[column.name])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      className="h-24 text-center"
                      colSpan={Math.max(result.columns.length, 1)}
                    >
                      The query returned no rows.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </div>
    </Page>
  );
}
