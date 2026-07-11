import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  Braces,
  CheckCircle2,
  Code2,
  DatabaseZap,
  FlaskConical,
  PlayCircle,
  RefreshCw,
  Replace,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { useMimicSdk } from "@/components/sdk-context";
import { useDatabase } from "@/components/database-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  databaseMigrationsQuery,
  databasesQuery,
  migrationStatusQuery,
  type MigrationRunState,
  type UiDatabaseMigration,
  type UiMigrationChange,
  type UiMigrationRunReport,
} from "@/lib/queries";

export const Route = createFileRoute("/_app/_layout/migrations")({
  component: MigrationsPage,
});

function formatMigrationVersion(version: number) {
  return String(version).padStart(5, "0");
}

function getMigrationSourcePath(migration: { version: number; name: string }) {
  return `migrations/${formatMigrationVersion(migration.version)}_${migration.name}.ts`;
}

function formatAppliedAt(value?: string) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatChangeTitle(change: UiMigrationChange) {
  if (change.type === "create") {
    return change.skipIfExists
      ? `Create ${change.collection} if missing`
      : `Create ${change.collection}`;
  }

  return `Update ${change.collection}`;
}

function stateBadge(state: MigrationRunState) {
  const props = (() => {
    switch (state) {
      case "succeeded":
        return { label: "Succeeded", variant: "default" as const };
      case "running":
        return { label: "Running", variant: "secondary" as const };
      case "failed":
        return { label: "Failed", variant: "destructive" as const };
      case "replaced":
        return { label: "Replaced", variant: "outline" as const };
      default:
        return { label: "Unknown", variant: "outline" as const };
    }
  })();
  return <Badge variant={props.variant}>{props.label}</Badge>;
}

// Convert UI shape back to the wire shape the server expects. The runner
// normalizes everything internally; we just need the JSON-ish fields named
// the way the wire wants them (`schema`, `oldSchema` instead of
// `schemaJson`, `oldSchemaJson`).
function uiChangeToWire(change: UiMigrationChange) {
  if (change.type === "create") {
    return {
      type: "create" as const,
      collection: change.collection,
      schema: change.schemaJson,
      skipIfExists: change.skipIfExists,
    };
  }
  return {
    type: "update" as const,
    collection: change.collection,
    schema: change.schemaJson,
    oldSchema: change.oldSchemaJson,
    dataMigrationSource: change.dataMigrationSource,
  };
}

function MigrationsPage() {
  const sdk = useMimicSdk();
  const queryClient = useQueryClient();
  const { selectedDatabaseId } = useDatabase();
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [lastReport, setLastReport] = useState<UiMigrationRunReport | null>(null);
  const [dryRunSampleLimit, setDryRunSampleLimit] = useState<string>("10");
  const [dryRunSamplePercent, setDryRunSamplePercent] = useState<string>("");
  const [batchSize, setBatchSize] = useState<string>("");

  const { data: databases } = useQuery(databasesQuery(sdk));
  const {
    data: migrations,
    isLoading,
    isError,
    error,
  } = useQuery({
    ...databaseMigrationsQuery(sdk, selectedDatabaseId ?? ""),
    enabled: !!selectedDatabaseId,
  });

  const selectedDatabase = databases?.find((database) => database.id === selectedDatabaseId);
  const typedMigrations = (migrations ?? []) as ReadonlyArray<UiDatabaseMigration>;

  useEffect(() => {
    if (typedMigrations.length === 0) {
      setSelectedVersion(null);
      return;
    }

    setSelectedVersion((current) =>
      current !== null && typedMigrations.some((migration) => migration.version === current)
        ? current
        : typedMigrations[typedMigrations.length - 1]!.version,
    );
  }, [typedMigrations]);

  const selectedMigration =
    typedMigrations.find((migration) => migration.version === selectedVersion) ??
    typedMigrations[typedMigrations.length - 1];

  const { data: status, isFetching: statusFetching } = useQuery({
    ...migrationStatusQuery(sdk, selectedDatabaseId ?? "", selectedMigration?.version ?? null),
    enabled: !!selectedDatabaseId && !!selectedMigration,
  });

  const refresh = () => {
    if (!selectedDatabaseId) {
      return;
    }
    queryClient.invalidateQueries({
      queryKey: ["database-migrations", selectedDatabaseId],
    });
    queryClient.invalidateQueries({
      queryKey: ["migration-status", selectedDatabaseId],
    });
  };

  const parsedBatchSize = batchSize.trim() === "" ? undefined : Number(batchSize);
  const parsedSampleLimit = dryRunSampleLimit.trim() === "" ? undefined : Number(dryRunSampleLimit);
  const parsedSamplePercent =
    dryRunSamplePercent.trim() === "" ? undefined : Number(dryRunSamplePercent);

  const rerunMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDatabaseId || !selectedMigration?.changes) {
        throw new Error("No selected migration with changes");
      }
      const handle = sdk.database(selectedDatabaseId);
      return handle.applyMigration({
        version: selectedMigration.version,
        name: selectedMigration.name,
        checksum: selectedMigration.checksum,
        changes: selectedMigration.changes.map(uiChangeToWire),
        mode: "rerun",
        batchSize: parsedBatchSize,
      });
    },
    onSuccess: (report) => {
      setLastReport(report as unknown as UiMigrationRunReport);
      refresh();
      if (report.state === "succeeded") {
        toast.success(`Rerun succeeded (${report.succeeded} migrated, ${report.skipped} skipped).`);
      } else {
        toast.error(`Rerun finished with ${report.failed} failure(s). See report below.`);
      }
    },
    onError: (err: Error) => toast.error(`Rerun failed: ${err.message}`),
  });

  const dryRunMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDatabaseId || !selectedMigration?.changes) {
        throw new Error("No selected migration with changes");
      }
      const handle = sdk.database(selectedDatabaseId);
      return handle.applyMigration({
        version: selectedMigration.version,
        name: selectedMigration.name,
        checksum: selectedMigration.checksum,
        changes: selectedMigration.changes.map(uiChangeToWire),
        mode: "apply",
        dryRun: {
          limit: parsedSampleLimit,
          samplePercent: parsedSamplePercent,
        },
        batchSize: parsedBatchSize,
      });
    },
    onSuccess: (report) => {
      setLastReport(report as unknown as UiMigrationRunReport);
      if (report.state === "succeeded") {
        toast.success(
          `Dry run succeeded against ${report.succeeded + report.failed + report.skipped} sampled doc(s).`,
        );
      } else {
        toast.error(`Dry run reported ${report.failed} failure(s). See report below.`);
      }
    },
    onError: (err: Error) => toast.error(`Dry run failed: ${err.message}`),
  });

  if (!selectedDatabaseId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Migrations</h2>
        <Card>
          <CardHeader>
            <CardTitle>Select a database</CardTitle>
            <CardDescription>
              Migrations are database-specific. Pick a database from the sidebar to inspect its
              applied migrations.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">Migrations</h2>
          <p className="text-sm text-muted-foreground">
            Inspect, retry, dry-run, and replace migrations for{" "}
            <span className="font-medium text-foreground">
              {selectedDatabase?.name ?? selectedDatabaseId}
            </span>
            .
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Badge variant="secondary">
            {typedMigrations.length} migration
            {typedMigrations.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading migrations...</p>
      ) : isError ? (
        <p className="text-destructive">Failed to load migrations: {error.message}</p>
      ) : typedMigrations.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No applied migrations</CardTitle>
            <CardDescription>
              This database does not have any applied migrations yet.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Applied Migrations</CardTitle>
              <CardDescription>
                Select a migration to inspect its run state and stored payload.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {typedMigrations.map((migration) => {
                const isActive = migration.version === selectedMigration?.version;
                return (
                  <Button
                    key={migration.version}
                    type="button"
                    variant={isActive ? "secondary" : "ghost"}
                    className="h-auto w-full justify-start px-3 py-3 text-left"
                    onClick={() => setSelectedVersion(migration.version)}
                  >
                    <div className="space-y-1 w-full">
                      <div className="flex items-center justify-between">
                        <div className="font-mono text-xs text-muted-foreground">
                          {formatMigrationVersion(migration.version)}
                        </div>
                        {stateBadge(migration.state)}
                      </div>
                      <div className="font-medium">{migration.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatAppliedAt(migration.appliedAt)}
                      </div>
                      {migration.totalDocuments > 0 ? (
                        <div className="text-xs text-muted-foreground">
                          {migration.succeededDocuments}/{migration.totalDocuments} docs
                          {migration.failedDocuments > 0
                            ? ` · ${migration.failedDocuments} failed`
                            : ""}
                        </div>
                      ) : null}
                    </div>
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          {selectedMigration ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DatabaseZap className="h-5 w-5" />
                    {formatMigrationVersion(selectedMigration.version)}_{selectedMigration.name}
                  </CardTitle>
                  <CardDescription>Stored migration record and run state.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      State
                    </div>
                    <div className="text-sm">{stateBadge(selectedMigration.state)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Documents
                    </div>
                    <div className="text-sm">
                      {selectedMigration.succeededDocuments}/{selectedMigration.totalDocuments}{" "}
                      succeeded
                      {selectedMigration.failedDocuments > 0
                        ? ` · ${selectedMigration.failedDocuments} failed`
                        : ""}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Source file
                    </div>
                    <div className="font-mono text-sm">
                      {getMigrationSourcePath(selectedMigration)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Applied at
                    </div>
                    <div className="text-sm">{formatAppliedAt(selectedMigration.appliedAt)}</div>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Checksum
                    </div>
                    <div className="break-all font-mono text-xs text-muted-foreground">
                      {selectedMigration.checksum}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Run Actions
                  </CardTitle>
                  <CardDescription>
                    Re-run failed/pending docs, simulate against a sample, or install a fixed
                    version under a new checksum.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor="batch-size">Batch size</Label>
                      <Input
                        id="batch-size"
                        type="number"
                        min={1}
                        placeholder="default"
                        value={batchSize}
                        onChange={(event) => setBatchSize(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="sample-limit">Dry-run sample limit</Label>
                      <Input
                        id="sample-limit"
                        type="number"
                        min={0}
                        placeholder="e.g. 10"
                        value={dryRunSampleLimit}
                        onChange={(event) => setDryRunSampleLimit(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="sample-percent">Dry-run sample percent</Label>
                      <Input
                        id="sample-percent"
                        type="number"
                        min={0}
                        max={100}
                        placeholder="e.g. 25"
                        value={dryRunSamplePercent}
                        onChange={(event) => setDryRunSamplePercent(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="default"
                      disabled={!selectedMigration.changes || rerunMutation.isPending}
                      onClick={() => rerunMutation.mutate()}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      {rerunMutation.isPending ? "Rerunning..." : "Rerun"}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!selectedMigration.changes || dryRunMutation.isPending}
                      onClick={() => dryRunMutation.mutate()}
                    >
                      <FlaskConical className="mr-2 h-4 w-4" />
                      {dryRunMutation.isPending ? "Running..." : "Dry-run on sample"}
                    </Button>
                    <ReplaceMigrationDialog
                      selectedDatabaseId={selectedDatabaseId}
                      selectedMigration={selectedMigration}
                      parsedBatchSize={parsedBatchSize}
                      onCompleted={(report) => {
                        setLastReport(report);
                        refresh();
                      }}
                    />
                  </div>

                  {!selectedMigration.changes ? (
                    <p className="text-xs text-muted-foreground">
                      This migration was applied before the server stored the change payload. Rerun
                      and dry-run are unavailable.
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              <MigrationStatusCard status={status ?? null} isFetching={statusFetching} />

              {lastReport ? <RunReportCard report={lastReport} /> : null}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Braces className="h-5 w-5" />
                    Applied Change Payload
                  </CardTitle>
                  <CardDescription>
                    Raw stored migration changes returned by the server.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-80 rounded-md border">
                    <pre className="p-4 text-xs">
                      {JSON.stringify(selectedMigration.changes ?? null, null, 2)}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>

              {selectedMigration.changes?.map((change, index) => (
                <Card key={`${selectedMigration.version}-${change.collection}-${index}`}>
                  <CardHeader>
                    <CardTitle>{formatChangeTitle(change)}</CardTitle>
                    <CardDescription>
                      Collection <span className="font-mono">{change.collection}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
                          New schema JSON
                        </div>
                        <ScrollArea className="h-64 rounded-md border">
                          <pre className="p-4 text-xs">
                            {JSON.stringify(change.schemaJson, null, 2)}
                          </pre>
                        </ScrollArea>
                      </div>

                      {"oldSchemaJson" in change && change.oldSchemaJson !== undefined ? (
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            Previous schema JSON
                          </div>
                          <ScrollArea className="h-64 rounded-md border">
                            <pre className="p-4 text-xs">
                              {JSON.stringify(change.oldSchemaJson, null, 2)}
                            </pre>
                          </ScrollArea>
                        </div>
                      ) : null}
                    </div>

                    {"dataMigrationSource" in change ? (
                      change.dataMigrationSource ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                            <Code2 className="h-4 w-4" />
                            Bundled data migration source
                          </div>
                          <ScrollArea className="h-96 rounded-md border bg-muted/30">
                            <pre className="p-4 text-xs">{change.dataMigrationSource}</pre>
                          </ScrollArea>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          This schema update did not include a bundled data migration source.
                        </p>
                      )
                    ) : null}
                  </CardContent>
                </Card>
              ))}

              {!selectedMigration.changes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Bundled source unavailable</CardTitle>
                    <CardDescription>
                      This migration was applied before the server started storing applied change
                      payloads.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MigrationStatusCard({
  status,
  isFetching,
}: {
  status: import("@/lib/queries").UiMigrationStatus | null;
  isFetching: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          Per-Document Status
        </CardTitle>
        <CardDescription>
          Live counts and failure list pulled from{" "}
          <code className="font-mono">getMigrationStatus</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isFetching && !status ? (
          <p className="text-sm text-muted-foreground">Loading status...</p>
        ) : status ? (
          <>
            <div className="flex flex-wrap gap-2">
              <StatusChip label="Succeeded" value={status.summary.succeeded} tone="success" />
              <StatusChip label="Failed" value={status.summary.failed} tone="destructive" />
              <StatusChip label="Pending" value={status.summary.pending} />
              <StatusChip label="Running" value={status.summary.running} />
              <StatusChip label="Skipped" value={status.summary.skipped} />
            </div>
            <Separator />
            {status.failures.length === 0 ? (
              <p className="text-sm text-muted-foreground">No failed documents.</p>
            ) : (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Failures ({status.failures.length})
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Attempt</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {status.failures.map((failure) => (
                      <TableRow key={failure.documentId}>
                        <TableCell className="font-mono text-xs">{failure.documentId}</TableCell>
                        <TableCell>{failure.attempt}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {failure.errorCode ?? "-"}
                        </TableCell>
                        <TableCell className="text-xs text-destructive">
                          {failure.errorMessage ?? "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Status not available.</p>
        )}
      </CardContent>
    </Card>
  );
}

function StatusChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "destructive";
}) {
  const variant: "default" | "destructive" | "outline" =
    tone === "success"
      ? value > 0
        ? "default"
        : "outline"
      : tone === "destructive"
        ? value > 0
          ? "destructive"
          : "outline"
        : "outline";
  return (
    <Badge variant={variant}>
      {label}: {value}
    </Badge>
  );
}

function RunReportCard({ report }: { report: UiMigrationRunReport }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {report.state === "succeeded" ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          Last Run Report{report.dryRun ? " (dry-run)" : ""}
        </CardTitle>
        <CardDescription>Outcome of the most-recent rerun, dry-run, or replace.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant={report.state === "succeeded" ? "default" : "destructive"}>
            {report.state}
          </Badge>
          <StatusChip label="Succeeded" value={report.succeeded} tone="success" />
          <StatusChip label="Failed" value={report.failed} tone="destructive" />
          <StatusChip label="Skipped" value={report.skipped} />
        </div>
        {report.perDocument.some((entry) => entry.status === "failed") ? (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Failed in this run
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.perDocument
                  .filter((entry) => entry.status === "failed")
                  .map((entry) => (
                    <TableRow key={`${entry.collectionId}:${entry.documentId}`}>
                      <TableCell className="font-mono text-xs">{entry.documentId}</TableCell>
                      <TableCell className="font-mono text-xs">{entry.errorCode ?? "-"}</TableCell>
                      <TableCell className="text-xs text-destructive">
                        {entry.errorMessage ?? "-"}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReplaceMigrationDialog({
  selectedDatabaseId,
  selectedMigration,
  parsedBatchSize,
  onCompleted,
}: {
  selectedDatabaseId: string;
  selectedMigration: UiDatabaseMigration;
  parsedBatchSize: number | undefined;
  onCompleted: (report: UiMigrationRunReport) => void;
}) {
  const sdk = useMimicSdk();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState(selectedMigration.name);
  const [newChecksum, setNewChecksum] = useState("");
  const [redoSucceeded, setRedoSucceeded] = useState(false);
  const [changesJson, setChangesJson] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    setNewName(selectedMigration.name);
    setNewChecksum("");
    setRedoSucceeded(false);
    setChangesJson(
      JSON.stringify(
        selectedMigration.changes?.map((change) => uiChangeToWire(change)) ?? [],
        null,
        2,
      ),
    );
  }, [open, selectedMigration]);

  const replaceMutation = useMutation({
    mutationFn: async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(changesJson);
      } catch (err) {
        throw new Error(
          `Changes JSON is not valid: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      if (!Array.isArray(parsed)) {
        throw new Error("Changes JSON must be an array.");
      }
      if (newChecksum.trim() === "") {
        throw new Error("New checksum is required.");
      }
      if (newChecksum === selectedMigration.checksum) {
        throw new Error("New checksum must differ from the current migration checksum.");
      }
      return sdk.database(selectedDatabaseId).applyMigration({
        version: selectedMigration.version,
        name: newName,
        checksum: newChecksum,
        changes: parsed as never,
        mode: "replace",
        batchSize: parsedBatchSize,
        redoSucceededOnReplace: redoSucceeded,
      });
    },
    onSuccess: (report) => {
      onCompleted(report as unknown as UiMigrationRunReport);
      setOpen(false);
      if (report.state === "succeeded") {
        toast.success(
          `Replace succeeded (${report.succeeded} migrated, ${report.skipped} skipped).`,
        );
      } else {
        toast.error(`Replace finished with ${report.failed} failure(s). See report below.`);
      }
    },
    onError: (err: Error) => toast.error(`Replace failed: ${err.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!selectedMigration.changes}>
          <Replace className="mr-2 h-4 w-4" />
          Replace...
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Replace migration {formatMigrationVersion(selectedMigration.version)}
          </DialogTitle>
          <DialogDescription>
            Install a fixed version of this migration under a new checksum. Failed and pending docs
            are reset and re-applied. Toggle <em>redo succeeded</em> to also re-process docs that
            already completed under the old checksum.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            replaceMutation.mutate();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="replace-name">Name</Label>
            <Input
              id="replace-name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="replace-checksum">New checksum</Label>
            <Input
              id="replace-checksum"
              value={newChecksum}
              placeholder={`differ from ${selectedMigration.checksum}`}
              onChange={(event) => setNewChecksum(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="replace-changes">Changes JSON</Label>
            <Textarea
              id="replace-changes"
              className="font-mono text-xs"
              rows={14}
              value={changesJson}
              onChange={(event) => setChangesJson(event.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Wire format. The migration runner normalizes server-side. Pre-filled with the existing
              change payload.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={redoSucceeded}
              onChange={(event) => setRedoSucceeded(event.target.checked)}
            />
            <span>Redo already-succeeded documents</span>
          </label>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={replaceMutation.isPending}>
              {replaceMutation.isPending ? "Replacing..." : "Replace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
