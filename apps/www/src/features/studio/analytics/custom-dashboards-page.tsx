import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AnalyticsDashboardType,
  QueryCustomAnalyticsInsightResponseType,
  SavedAnalyticsInsightType,
} from "@voidhash/rpc";
import { INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type ChartConfig,
  ChartContainer,
  Input,
  Label,
  Page,
  PageHeader,
  PageHeaderTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@voidhash/ui";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChartSpline,
  Columns2,
  Copy,
  LayoutDashboard,
  Pencil,
  Plus,
  Rows3,
  RefreshCw,
  SlidersHorizontal,
  Save,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, Line, LineChart, XAxis, YAxis } from "recharts";

import { useAuth } from "@/features/studio/components/auth-context";
import {
  createAnalyticsDashboardOptions,
  customAnalyticsInsightQueryOptions,
  deleteAnalyticsDashboardOptions,
  duplicateAnalyticsDashboardOptions,
  listAnalyticsDashboardsOptions,
  listAnalyticsInsightsOptions,
  listVoidQlInsightsOptions,
  putAnalyticsDashboardItemOptions,
  queryKeys,
  reorderAnalyticsDashboardItemsOptions,
  removeAnalyticsDashboardItemOptions,
  runSavedVoidQlInsightOptions,
  updateAnalyticsDashboardOptions,
} from "@/features/studio/lib/tanstack-query";
import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

interface CustomDashboardsPageProps {
  organizationSlug: string;
  projectSlug: string;
}

/** Render project dashboards and their saved insight cards. */
export function CustomDashboardsPage({ organizationSlug, projectSlug }: CustomDashboardsPageProps) {
  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(user, organizationSlug, projectSlug);
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string>();
  const [name, setName] = useState("Mobile product overview");
  const [description, setDescription] = useState("");
  const createDashboard = useMutation(createAnalyticsDashboardOptions());
  const dashboards = useQuery({
    ...listAnalyticsDashboardsOptions({ projectId: project?.id ?? "missing-project" }),
    enabled: project !== undefined,
  });

  if (!project) {
    return <VoidhashErrorCard error={{ code: "NOT_FOUND", message: "Project not found" }} />;
  }

  const selectedDashboard = dashboards.data?.dashboards.find(
    (dashboard) => dashboard.id === selectedDashboardId,
  );
  const onCreate = () => {
    createDashboard.mutate(
      {
        description: description.trim() || undefined,
        name: name.trim(),
        projectId: project.id,
      },
      {
        onSuccess: async (dashboard) => {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.analytics.dashboards({ projectId: project.id }),
          });
          setCreating(false);
          setDescription("");
          setSelectedDashboardId(dashboard.id);
        },
      },
    );
  };

  if (selectedDashboard) {
    return (
      <DashboardEditor
        dashboard={selectedDashboard}
        onBack={() => setSelectedDashboardId(undefined)}
        organizationId={project.organizationId}
        projectId={project.id}
      />
    );
  }

  return (
    <Page>
      <PageHeader
        rightActions={
          <Button onClick={() => setCreating((value) => !value)}>
            <Plus />
            New dashboard
          </Button>
        }
      >
        <PageHeaderTitle>Dashboards</PageHeaderTitle>
      </PageHeader>
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
        <div>
          <h2 className="font-medium text-2xl tracking-tight">Analytics dashboards</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Arrange reusable insights into focused views for product, growth, and release health.
          </p>
        </div>

        {creating ? (
          <Card className="max-w-2xl border-primary/30">
            <CardHeader>
              <CardTitle>Create dashboard</CardTitle>
              <CardDescription>
                Start empty, then add saved insights as they become useful.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dashboard-name">Name</Label>
                <Input
                  id="dashboard-name"
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dashboard-description">Description</Label>
                <Textarea
                  id="dashboard-description"
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Who is this dashboard for?"
                  value={description}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={() => setCreating(false)} variant="ghost">
                  Cancel
                </Button>
                <Button disabled={!name.trim() || createDashboard.isPending} onClick={onCreate}>
                  {createDashboard.isPending ? "Creating…" : "Create dashboard"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {dashboards.data?.dashboards.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dashboards.data.dashboards.map((dashboard) => (
              <button
                className="text-left"
                key={dashboard.id}
                onClick={() => setSelectedDashboardId(dashboard.id)}
                type="button"
              >
                <Card className="min-h-48 transition-colors hover:border-foreground/20">
                  <CardHeader>
                    <div className="mb-3 w-fit rounded-lg bg-primary/10 p-2 text-primary">
                      <LayoutDashboard />
                    </div>
                    <CardTitle>{dashboard.name}</CardTitle>
                    <CardDescription>
                      {dashboard.description || "A custom analytics workspace."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-muted-foreground text-sm">
                    {dashboard.items.length} insight{dashboard.items.length === 1 ? "" : "s"}
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        ) : !creating ? (
          <button
            className="flex w-full flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center transition-colors hover:border-foreground/30 hover:bg-muted/30"
            onClick={() => setCreating(true)}
            type="button"
          >
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <LayoutDashboard />
            </div>
            <span className="mt-4 font-medium">Create your first dashboard</span>
            <span className="mt-1 max-w-md text-muted-foreground text-sm">
              Group product insights around a release, funnel, or feature area.
            </span>
          </button>
        ) : null}
      </div>
    </Page>
  );
}

function DashboardEditor({
  dashboard,
  onBack,
  organizationId,
  projectId,
}: {
  dashboard: AnalyticsDashboardType;
  onBack: () => void;
  organizationId: string;
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const voidQlEnabled = useInternalFeatureFlag(INTERNAL_FEATURE_FLAGS.voidqlQuery.key);
  const insights = useQuery(listAnalyticsInsightsOptions({ projectId }));
  const savedQueries = useQuery({
    ...listVoidQlInsightsOptions({ organizationId }),
    enabled: voidQlEnabled,
  });
  const [sourceValue, setSourceValue] = useState("");
  const [editingLayout, setEditingLayout] = useState(false);
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [dashboardName, setDashboardName] = useState(dashboard.name);
  const [dashboardDescription, setDashboardDescription] = useState(dashboard.description ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const putItem = useMutation(putAnalyticsDashboardItemOptions());
  const reorderItems = useMutation(reorderAnalyticsDashboardItemsOptions());
  const removeItem = useMutation(removeAnalyticsDashboardItemOptions());
  const updateDashboard = useMutation(updateAnalyticsDashboardOptions());
  const deleteDashboard = useMutation(deleteAnalyticsDashboardOptions());
  const duplicateDashboard = useMutation(duplicateAnalyticsDashboardOptions());
  const availableInsights =
    insights.data?.insights.filter(
      (insight) =>
        !dashboard.items.some((item) => item.kind === "insight" && item.insight.id === insight.id),
    ) ?? [];
  const availableQueries =
    savedQueries.data?.insights.filter(
      (query) =>
        !dashboard.items.some((item) => item.kind === "voidql" && item.query.id === query.id),
    ) ?? [];
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics.dashboards({ projectId }) });
  const refreshCards = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
      queryClient.invalidateQueries({ queryKey: ["runSavedVoidQlInsight"] }),
    ]);
  };

  const addInsight = () => {
    const [kind, id] = sourceValue.split(":", 2);
    if (!id || (kind !== "insight" && kind !== "voidql")) return;
    putItem.mutate(
      {
        dashboardId: dashboard.id,
        layout: { height: 1, width: 1, x: dashboard.items.length % 2, y: dashboard.items.length },
        position: dashboard.items.length,
        source: { id, kind },
      },
      {
        onSuccess: async () => {
          setSourceValue("");
          await refresh();
        },
      },
    );
  };
  const removeInsight = (itemId: string) =>
    removeItem.mutate({ dashboardId: dashboard.id, itemId }, { onSuccess: refresh });
  const updateItem = (
    item: AnalyticsDashboardType["items"][number],
    layout: AnalyticsDashboardType["items"][number]["layout"],
  ) =>
    putItem.mutate(
      {
        dashboardId: dashboard.id,
        layout,
        position: item.position,
        source: {
          id: item.kind === "insight" ? item.insight.id : item.query.id,
          kind: item.kind,
        },
      },
      { onSuccess: refresh },
    );
  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (!dashboard.items[index] || !dashboard.items[targetIndex]) return;
    const itemIds = dashboard.items.map((item) => item.id);
    [itemIds[index], itemIds[targetIndex]] = [itemIds[targetIndex], itemIds[index]];
    const firstItemId = itemIds[0];
    if (!firstItemId) return;
    reorderItems.mutate(
      { dashboardId: dashboard.id, itemIds: [firstItemId, ...itemIds.slice(1)] },
      { onSuccess: refresh },
    );
  };
  const saveDashboard = () =>
    updateDashboard.mutate(
      {
        description: dashboardDescription.trim() || null,
        id: dashboard.id,
        name: dashboardName.trim(),
      },
      {
        onSuccess: async () => {
          await refresh();
          setEditingMetadata(false);
        },
      },
    );
  const requestDeleteDashboard = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    deleteDashboard.mutate(
      { id: dashboard.id },
      {
        onSuccess: async () => {
          await refresh();
          onBack();
        },
      },
    );
  };

  return (
    <Page>
      <PageHeader
        rightActions={
          <div className="flex min-w-80 gap-2">
            <Button
              disabled={duplicateDashboard.isPending}
              onClick={() =>
                duplicateDashboard.mutate({ id: dashboard.id }, { onSuccess: () => void refresh() })
              }
              variant="outline"
            >
              <Copy /> {duplicateDashboard.isPending ? "Duplicating…" : "Duplicate"}
            </Button>
            <Button onClick={() => void refreshCards()} variant="outline">
              <RefreshCw /> Refresh
            </Button>
            <Button onClick={() => setEditingMetadata((current) => !current)} variant="outline">
              <Pencil />
              Details
            </Button>
            <Button
              aria-pressed={editingLayout}
              onClick={() => setEditingLayout((current) => !current)}
              variant={editingLayout ? "default" : "outline"}
            >
              <SlidersHorizontal />
              {editingLayout ? "Done" : "Edit layout"}
            </Button>
            <Select onValueChange={setSourceValue} value={sourceValue}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a saved insight" />
              </SelectTrigger>
              <SelectContent>
                {availableInsights.map((insight) => (
                  <SelectItem key={insight.id} value={`insight:${insight.id}`}>
                    {insight.name}
                  </SelectItem>
                ))}
                {voidQlEnabled
                  ? availableQueries.map((query) => (
                      <SelectItem key={query.id} value={`voidql:${query.id}`}>
                        Query · {query.name}
                      </SelectItem>
                    ))
                  : null}
              </SelectContent>
            </Select>
            <Button disabled={!sourceValue || putItem.isPending} onClick={addInsight}>
              <Plus /> Add
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-3">
          <Button aria-label="Back to dashboards" onClick={onBack} size="icon" variant="ghost">
            <ArrowLeft />
          </Button>
          <div>
            <PageHeaderTitle>{dashboard.name}</PageHeaderTitle>
            {dashboard.description ? (
              <p className="text-muted-foreground text-xs">{dashboard.description}</p>
            ) : null}
          </div>
        </div>
      </PageHeader>
      {editingMetadata ? (
        <div className="border-b bg-muted/20 px-4 py-4">
          <Card className="mx-auto max-w-3xl">
            <CardHeader>
              <CardTitle>Dashboard details</CardTitle>
              <CardDescription>Rename, describe, or delete this dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-dashboard-name">Name</Label>
                <Input
                  id="edit-dashboard-name"
                  onChange={(event) => setDashboardName(event.target.value)}
                  value={dashboardName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dashboard-description">Description</Label>
                <Textarea
                  id="edit-dashboard-description"
                  onChange={(event) => setDashboardDescription(event.target.value)}
                  value={dashboardDescription}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  disabled={deleteDashboard.isPending}
                  onClick={requestDeleteDashboard}
                  variant="destructive"
                >
                  <Trash2 />
                  {deleteDashboard.isPending
                    ? "Deleting…"
                    : confirmingDelete
                      ? "Confirm delete"
                      : "Delete dashboard"}
                </Button>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setEditingMetadata(false);
                      setConfirmingDelete(false);
                    }}
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={!dashboardName.trim() || updateDashboard.isPending}
                    onClick={saveDashboard}
                  >
                    <Save /> {updateDashboard.isPending ? "Saving…" : "Save details"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
      <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-6 md:grid-cols-2">
        {dashboard.items.length ? (
          dashboard.items.map((item, index) => (
            <div
              className={item.layout.width >= 2 ? "md:col-span-2" : "md:col-span-1"}
              key={item.id}
            >
              {item.kind === "insight" ? (
                <DashboardInsightCard
                  canMoveDown={index < dashboard.items.length - 1}
                  canMoveUp={index > 0}
                  editingLayout={editingLayout}
                  insight={item.insight}
                  layout={item.layout}
                  onMoveDown={() => moveItem(index, 1)}
                  onMoveUp={() => moveItem(index, -1)}
                  onRemove={() => removeInsight(item.id)}
                  onResize={(layout) => updateItem(item, layout)}
                  projectId={projectId}
                />
              ) : (
                <DashboardVoidQlCard
                  canMoveDown={index < dashboard.items.length - 1}
                  canMoveUp={index > 0}
                  editingLayout={editingLayout}
                  item={item}
                  onMoveDown={() => moveItem(index, 1)}
                  onMoveUp={() => moveItem(index, -1)}
                  onRemove={() => removeInsight(item.id)}
                  onResize={(layout) => updateItem(item, layout)}
                  queryEnabled={voidQlEnabled}
                />
              )}
            </div>
          ))
        ) : (
          <div className="col-span-full rounded-xl border border-dashed px-6 py-16 text-center">
            <LayoutDashboard className="mx-auto text-muted-foreground" />
            <p className="mt-3 font-medium">This dashboard is empty</p>
            <p className="mt-1 text-muted-foreground text-sm">
              Choose a saved insight above to add the first card.
            </p>
          </div>
        )}
      </div>
    </Page>
  );
}

function DashboardVoidQlCard({
  canMoveDown,
  canMoveUp,
  editingLayout,
  item,
  onMoveDown,
  onMoveUp,
  onRemove,
  onResize,
  queryEnabled,
}: {
  canMoveDown: boolean;
  canMoveUp: boolean;
  editingLayout: boolean;
  item: Extract<AnalyticsDashboardType["items"][number], { readonly kind: "voidql" }>;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onRemove: () => void;
  onResize: (layout: AnalyticsDashboardType["items"][number]["layout"]) => void;
  queryEnabled: boolean;
}) {
  const result = useQuery({
    ...runSavedVoidQlInsightOptions({ id: item.query.id }),
    enabled: queryEnabled,
  });
  const name = item.query.name;
  return (
    <Card className={item.layout.height >= 2 ? "min-h-[40rem]" : "min-h-80"}>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>{name}</CardTitle>
          <CardDescription>VoidQL query</CardDescription>
        </div>
        <div className="flex items-center gap-1">
          {editingLayout ? (
            <>
              <Button
                aria-label={`Move ${name} up`}
                disabled={!canMoveUp}
                onClick={onMoveUp}
                size="icon"
                variant="ghost"
              >
                <ArrowUp size={16} />
              </Button>
              <Button
                aria-label={`Move ${name} down`}
                disabled={!canMoveDown}
                onClick={onMoveDown}
                size="icon"
                variant="ghost"
              >
                <ArrowDown size={16} />
              </Button>
              <Button
                aria-label={`Resize ${name} width`}
                onClick={() => onResize({ ...item.layout, width: item.layout.width >= 2 ? 1 : 2 })}
                size="icon"
                variant="ghost"
              >
                <Columns2 size={16} />
              </Button>
              <Button
                aria-label={`Resize ${name} height`}
                onClick={() =>
                  onResize({ ...item.layout, height: item.layout.height >= 2 ? 1 : 2 })
                }
                size="icon"
                variant="ghost"
              >
                <Rows3 size={16} />
              </Button>
            </>
          ) : null}
          <Button aria-label={`Remove ${name}`} onClick={onRemove} size="icon" variant="ghost">
            <Trash2 size={16} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!queryEnabled ? (
          <div className="flex h-52 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
            VoidQL is not enabled for this workspace.
          </div>
        ) : result.data ? (
          <div className="max-h-80 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {result.data.columns.map((column) => (
                    <TableHead key={column.name}>{column.name}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.rows.slice(0, item.layout.height >= 2 ? 50 : 10).map((row, index) => (
                  <TableRow key={index}>
                    {result.data.columns.map((column) => (
                      <TableCell className="font-mono text-xs" key={column.name}>
                        {formatVoidQlCell(row[column.name])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex h-52 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
            {result.isLoading ? "Running saved query…" : "The saved query could not be rendered."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatVoidQlCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function DashboardInsightCard({
  canMoveDown,
  canMoveUp,
  editingLayout,
  insight,
  layout,
  onMoveDown,
  onMoveUp,
  onRemove,
  onResize,
  projectId,
}: {
  canMoveDown: boolean;
  canMoveUp: boolean;
  editingLayout: boolean;
  insight: SavedAnalyticsInsightType;
  layout: AnalyticsDashboardType["items"][number]["layout"];
  onMoveDown: () => void;
  onMoveUp: () => void;
  onRemove: () => void;
  onResize: (layout: AnalyticsDashboardType["items"][number]["layout"]) => void;
  projectId: string;
}) {
  const query = useQuery({
    ...customAnalyticsInsightQueryOptions({ definition: insight.definition, projectId }),
    enabled:
      insight.kind === "trends" ||
      insight.kind === "funnels" ||
      insight.kind === "retention" ||
      insight.kind === "paths" ||
      insight.kind === "stickiness" ||
      insight.kind === "lifecycle",
  });
  const trendsResult = query.data?.kind === "trends" ? query.data : undefined;
  const funnelResult = query.data?.kind === "funnels" ? query.data : undefined;
  const retentionResult = query.data?.kind === "retention" ? query.data : undefined;
  const pathsResult = query.data?.kind === "paths" ? query.data : undefined;
  const stickinessResult = query.data?.kind === "stickiness" ? query.data : undefined;
  const lifecycleResult = query.data?.kind === "lifecycle" ? query.data : undefined;
  const stickinessDisplay =
    insight.definition.kind === "stickiness" ? (insight.definition.display ?? "bar") : "bar";
  const trendsDisplay = insight.definition.kind === "trends" ? insight.definition.display : "line";
  const trendPalette = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];
  const trendPointsByDate = new Map<string, Record<string, number | string>>();
  const trendColorByBaseKey = new Map<string, string>();
  const trendSeriesColors = new Map<string, string>();
  for (const series of trendsResult?.series ?? []) {
    const baseKey = series.key.split(":comparison:")[0] ?? series.key;
    const color =
      trendColorByBaseKey.get(baseKey) ??
      trendPalette[trendColorByBaseKey.size % trendPalette.length] ??
      "var(--chart-1)";
    trendColorByBaseKey.set(baseKey, color);
    trendSeriesColors.set(series.key, color);
    for (const point of series.points) {
      const date = point.timestamp.toISOString();
      const row = trendPointsByDate.get(date) ?? { date };
      row[series.key] = point.value;
      trendPointsByDate.set(date, row);
    }
  }
  const trendPoints = [...trendPointsByDate.values()].sort((left, right) =>
    String(left.date).localeCompare(String(right.date)),
  );
  const formatTrendDate = (value: string) =>
    new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const trendChartConfig = Object.fromEntries(
    (trendsResult?.series ?? []).map((series) => [
      series.key,
      {
        color: trendSeriesColors.get(series.key) ?? "var(--chart-1)",
        label: series.label,
      },
    ]),
  ) satisfies ChartConfig;

  return (
    <Card className={layout.height >= 2 ? "min-h-[40rem]" : "min-h-80"}>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>{insight.name}</CardTitle>
          <CardDescription>{insight.description || insight.kind}</CardDescription>
        </div>
        <div className="flex items-center gap-1">
          {editingLayout ? (
            <>
              <Button
                aria-label={`Move ${insight.name} up`}
                disabled={!canMoveUp}
                onClick={onMoveUp}
                size="icon"
                title="Move up"
                variant="ghost"
              >
                <ArrowUp size={16} />
              </Button>
              <Button
                aria-label={`Move ${insight.name} down`}
                disabled={!canMoveDown}
                onClick={onMoveDown}
                size="icon"
                title="Move down"
                variant="ghost"
              >
                <ArrowDown size={16} />
              </Button>
              <Button
                aria-label={`${layout.width >= 2 ? "Make" : "Expand"} ${insight.name} ${layout.width >= 2 ? "half width" : "to full width"}`}
                onClick={() => onResize({ ...layout, width: layout.width >= 2 ? 1 : 2 })}
                size="icon"
                title={layout.width >= 2 ? "Half width" : "Full width"}
                variant="ghost"
              >
                <Columns2 size={16} />
              </Button>
              <Button
                aria-label={`${layout.height >= 2 ? "Reduce" : "Increase"} ${insight.name} height`}
                onClick={() => onResize({ ...layout, height: layout.height >= 2 ? 1 : 2 })}
                size="icon"
                title={layout.height >= 2 ? "Standard height" : "Tall card"}
                variant="ghost"
              >
                <Rows3 size={16} />
              </Button>
            </>
          ) : null}
          <Button
            aria-label={`Remove ${insight.name}`}
            onClick={onRemove}
            size="icon"
            variant="ghost"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {lifecycleResult ? (
          <LifecycleDashboardPreview
            display={
              insight.definition.kind === "lifecycle"
                ? (insight.definition.display ?? "stacked_area")
                : "stacked_area"
            }
            result={lifecycleResult}
            valueMode={
              insight.definition.kind === "lifecycle"
                ? (insight.definition.valueMode ?? "count")
                : "count"
            }
          />
        ) : stickinessResult ? (
          <StickinessDashboardPreview display={stickinessDisplay} result={stickinessResult} />
        ) : pathsResult ? (
          <div className="space-y-2">
            {pathsResult.links.slice(0, 7).map((link) => {
              const maximum = Math.max(1, ...pathsResult.links.map((candidate) => candidate.count));
              return (
                <div
                  className="relative overflow-hidden rounded-lg border px-3 py-2"
                  key={`${link.sourceStep}:${link.source}:${link.targetStep}:${link.target}`}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-emerald-500/10"
                    style={{ width: `${Math.max(4, (link.count / maximum) * 100)}%` }}
                  />
                  <div className="relative flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      {link.source} <span className="text-muted-foreground">→</span> {link.target}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {link.count.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : retentionResult ? (
          <div className="space-y-1 overflow-x-auto">
            {retentionResult.cohorts.slice(-5).map((cohort) => (
              <div className="flex min-w-max gap-1" key={cohort.cohortStart.toISOString()}>
                <span className="w-20 truncate text-muted-foreground text-xs">
                  {cohort.cohortStart.toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                {cohort.cells.slice(0, 6).map((cell) => (
                  <span
                    className="flex h-8 w-12 items-center justify-center rounded text-[10px] tabular-nums"
                    key={cell.interval}
                    style={{ backgroundColor: `rgba(14, 165, 233, ${Math.max(0.08, cell.rate)})` }}
                  >
                    {(cell.rate * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
            ))}
          </div>
        ) : funnelResult ? (
          <div className="space-y-2">
            {funnelResult.steps.map((step) => (
              <div className="rounded-lg border p-3" key={step.key}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate">
                    {step.step}. {step.label}
                  </span>
                  <span className="font-medium tabular-nums">
                    {(step.conversionRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${Math.max(1, step.conversionRate * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : trendsDisplay === "number" &&
          trendsResult?.series.some((series) => series.points.length) ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {trendsResult.series.map((series) => (
              <div className="rounded-lg border bg-muted/20 p-4" key={series.key}>
                <p className="truncate text-muted-foreground text-xs">{series.label}</p>
                <p className="mt-1 font-semibold text-2xl tabular-nums tracking-tight">
                  {(series.points[0]?.value ?? 0).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            ))}
          </div>
        ) : trendPoints.length ? (
          <ChartContainer className="h-52 w-full" config={trendChartConfig}>
            {trendsDisplay === "bar" ? (
              <BarChart data={trendPoints}>
                <XAxis
                  axisLine={false}
                  dataKey="date"
                  tickFormatter={formatTrendDate}
                  tickLine={false}
                />
                <YAxis axisLine={false} tickLine={false} width={36} />
                {(trendsResult?.series ?? []).map((series) => (
                  <Bar
                    dataKey={series.key}
                    fill={trendSeriesColors.get(series.key) ?? "var(--chart-1)"}
                    fillOpacity={series.comparison && series.comparison !== "current" ? 0.4 : 0.85}
                    key={series.key}
                    radius={3}
                  />
                ))}
              </BarChart>
            ) : trendsDisplay === "area" ? (
              <AreaChart data={trendPoints}>
                <XAxis
                  axisLine={false}
                  dataKey="date"
                  tickFormatter={formatTrendDate}
                  tickLine={false}
                />
                <YAxis axisLine={false} tickLine={false} width={36} />
                {(trendsResult?.series ?? []).map((series) => (
                  <Area
                    dataKey={series.key}
                    fill={trendSeriesColors.get(series.key) ?? "var(--chart-1)"}
                    fillOpacity={series.comparison && series.comparison !== "current" ? 0.08 : 0.18}
                    key={series.key}
                    stroke={trendSeriesColors.get(series.key) ?? "var(--chart-1)"}
                    strokeDasharray={
                      series.comparison && series.comparison !== "current" ? "6 5" : undefined
                    }
                    strokeWidth={2}
                    type="monotone"
                  />
                ))}
              </AreaChart>
            ) : (
              <LineChart data={trendPoints}>
                <XAxis
                  axisLine={false}
                  dataKey="date"
                  tickFormatter={formatTrendDate}
                  tickLine={false}
                />
                <YAxis axisLine={false} tickLine={false} width={36} />
                {(trendsResult?.series ?? []).map((series) => (
                  <Line
                    dataKey={series.key}
                    dot={false}
                    key={series.key}
                    stroke={trendSeriesColors.get(series.key) ?? "var(--chart-1)"}
                    strokeDasharray={
                      series.comparison && series.comparison !== "current" ? "6 5" : undefined
                    }
                    strokeWidth={2}
                    type="monotone"
                  />
                ))}
              </LineChart>
            )}
          </ChartContainer>
        ) : (
          <div className="flex h-52 items-center justify-center rounded-lg border border-dashed bg-muted/20 text-center text-muted-foreground text-sm">
            <div>
              <ChartSpline className="mx-auto mb-2" />
              {insight.kind === "trends" ||
              insight.kind === "funnels" ||
              insight.kind === "retention" ||
              insight.kind === "paths" ||
              insight.kind === "stickiness" ||
              insight.kind === "lifecycle"
                ? query.isLoading
                  ? "Loading insight…"
                  : "No values in this range"
                : `${insight.kind} execution is coming next`}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type LifecycleResult = Extract<
  QueryCustomAnalyticsInsightResponseType,
  { readonly kind: "lifecycle" }
>;

function LifecycleDashboardPreview({
  display,
  result,
  valueMode,
}: {
  display: "line" | "stacked_area";
  result: LifecycleResult;
  valueMode: "count" | "percentage";
}) {
  const colors = {
    dormant: "var(--chart-5)",
    new: "var(--chart-2)",
    resurrecting: "var(--chart-3)",
    returning: "var(--chart-1)",
  } as const;
  const rows = new Map<string, Record<string, number | string>>();
  for (const series of result.series) {
    for (const point of series.points) {
      const date = point.timestamp.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      });
      const row = rows.get(date) ?? { date };
      row[series.status] = series.status === "dormant" ? -point.count : point.count;
      rows.set(date, row);
    }
  }
  const config = Object.fromEntries(
    result.series.map((series) => [
      series.status,
      { color: colors[series.status], label: series.status },
    ]),
  ) satisfies ChartConfig;
  const data = [...rows.values()].map((row) => {
    if (valueMode === "count") return row;
    const total = result.series.reduce((sum, series) => {
      const value = row[series.status];
      return sum + Math.abs(typeof value === "number" ? value : 0);
    }, 0);
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        key === "date" || typeof value !== "number" || total === 0 ? value : (value / total) * 100,
      ]),
    );
  });

  return (
    <ChartContainer className="h-52 w-full" config={config}>
      {display === "line" ? (
        <LineChart data={data}>
          <XAxis axisLine={false} dataKey="date" tickLine={false} />
          <YAxis axisLine={false} allowDecimals={false} tickLine={false} width={36} />
          {result.series.map((series) => (
            <Line
              dataKey={series.status}
              dot={false}
              key={series.status}
              stroke={colors[series.status]}
              strokeWidth={2}
              type="monotone"
            />
          ))}
        </LineChart>
      ) : (
        <AreaChart data={data} stackOffset="sign">
          <XAxis axisLine={false} dataKey="date" tickLine={false} />
          <YAxis axisLine={false} allowDecimals={false} tickLine={false} width={36} />
          {result.series.map((series) => (
            <Area
              dataKey={series.status}
              fill={colors[series.status]}
              fillOpacity={0.28}
              key={series.status}
              stackId="lifecycle"
              stroke={colors[series.status]}
              type="monotone"
            />
          ))}
        </AreaChart>
      )}
    </ChartContainer>
  );
}

type StickinessResult = Extract<
  QueryCustomAnalyticsInsightResponseType,
  { readonly kind: "stickiness" }
>;

function StickinessDashboardPreview({
  display,
  result,
}: {
  display: "bar" | "line";
  result: StickinessResult;
}) {
  const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
  if (display === "line") {
    const rows = new Map<number, Record<string, number>>();
    for (const series of result.series) {
      for (const bucket of series.buckets) {
        const row = rows.get(bucket.intervals) ?? { intervals: bucket.intervals };
        row[series.key] = bucket.count;
        rows.set(bucket.intervals, row);
      }
    }
    const config = Object.fromEntries(
      result.series.map((series, index) => [
        series.key,
        { color: palette[index % palette.length] ?? "var(--chart-1)", label: series.label },
      ]),
    ) satisfies ChartConfig;
    return (
      <ChartContainer className="h-52 w-full" config={config}>
        <LineChart
          data={[...rows.values()].sort((left, right) => left.intervals - right.intervals)}
        >
          <XAxis axisLine={false} dataKey="intervals" tickLine={false} />
          <YAxis axisLine={false} allowDecimals={false} tickLine={false} width={36} />
          {result.series.map((series, index) => (
            <Line
              dataKey={series.key}
              dot={false}
              key={series.key}
              stroke={palette[index % palette.length] ?? "var(--chart-1)"}
              strokeWidth={2}
              type="monotone"
            />
          ))}
        </LineChart>
      </ChartContainer>
    );
  }

  return (
    <div className="space-y-4">
      {result.series.map((series) => {
        const maximum = Math.max(1, ...series.buckets.map((bucket) => bucket.count));
        return (
          <div key={series.key}>
            <p className="mb-2 truncate text-muted-foreground text-xs">{series.label}</p>
            <div className="flex h-32 items-end gap-1">
              {series.buckets.slice(0, 20).map((bucket) => (
                <div
                  className="min-w-2 flex-1 rounded-t bg-amber-500"
                  key={bucket.intervals}
                  style={{ height: `${Math.max(3, (bucket.count / maximum) * 100)}%` }}
                  title={`${bucket.intervals}: ${bucket.count.toLocaleString()}`}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
