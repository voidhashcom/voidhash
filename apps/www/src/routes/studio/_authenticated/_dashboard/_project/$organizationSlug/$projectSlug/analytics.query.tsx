import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Button,
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
import { useState } from "react";

import { useAuth } from "@/features/studio/components/auth-context";
import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";
import { runVoidQlQueryOptions } from "@/features/studio/lib/tanstack-query";
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
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
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

  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  const runQuery = useMutation(runVoidQlQueryOptions());

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
          <div className="flex items-center gap-3">
            <Button disabled={runQuery.isPending || text.trim().length === 0} onClick={onRun}>
              {runQuery.isPending ? "Running…" : "Run"}
            </Button>
            {result ? (
              <span className="text-muted-foreground text-sm">
                {result.rows.length} row{result.rows.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </div>

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
