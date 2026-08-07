import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AnalyticsEventSeriesType,
  AnalyticsTimeRangeType,
  AnalyticsTrendsComparisonType,
  CustomAnalyticsInsightKindType,
  CustomAnalyticsInsightQueryType,
  FunnelsInsightQueryType,
  QueryCustomAnalyticsInsightResponseType,
  QueryCustomAnalyticsPersonsResponseType,
} from "@voidhash/rpc";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
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
  Textarea,
} from "@voidhash/ui";
import {
  Activity,
  ArrowLeft,
  ChartNoAxesCombined,
  ChartSpline,
  Filter,
  GitBranch,
  Layers3,
  Pencil,
  Plus,
  Repeat2,
  Save,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import { useAuth } from "@/features/studio/components/auth-context";
import {
  createAnalyticsCohortOptions,
  createAnalyticsInsightOptions,
  deleteAnalyticsCohortOptions,
  deleteAnalyticsInsightOptions,
  listAnalyticsCohortsOptions,
  listAnalyticsInsightsOptions,
  listPersonsOptions,
  queryCustomAnalyticsInsightOptions,
  queryCustomAnalyticsPersonsOptions,
  queryKeys,
  updateAnalyticsCohortOptions,
} from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

const insightTypes: ReadonlyArray<{
  color: string;
  description: string;
  icon: typeof ChartSpline;
  kind: CustomAnalyticsInsightKindType;
  label: string;
  live: boolean;
}> = [
  {
    color: "text-sky-500",
    description: "Track event volume and unique users over time.",
    icon: ChartSpline,
    kind: "trends",
    label: "Trends",
    live: true,
  },
  {
    color: "text-violet-500",
    description: "Measure conversion through ordered mobile flows.",
    icon: Filter,
    kind: "funnels",
    label: "Funnels",
    live: true,
  },
  {
    color: "text-rose-500",
    description: "See who returns after a starting behavior.",
    icon: Repeat2,
    kind: "retention",
    label: "Retention",
    live: true,
  },
  {
    color: "text-emerald-500",
    description: "Explore the routes users take between events.",
    icon: GitBranch,
    kind: "paths",
    label: "User paths",
    live: true,
  },
  {
    color: "text-amber-500",
    description: "Understand how frequently users repeat behavior.",
    icon: Activity,
    kind: "stickiness",
    label: "Stickiness",
    live: true,
  },
  {
    color: "text-cyan-500",
    description: "Separate new, returning, resurrected, and dormant users.",
    icon: Layers3,
    kind: "lifecycle",
    label: "Lifecycle",
    live: true,
  },
];

interface CustomInsightsPageProps {
  organizationSlug: string;
  projectSlug: string;
}

interface AuthoringSeries {
  aggregation: AnalyticsEventSeriesType["aggregation"];
  eventName: string;
  key: string;
  mathProperty?: string;
}

interface AuthoringFormula {
  expression: string;
  key: string;
  label: string;
}

interface AuthoringFunnelStep {
  eventName: string;
  key: string;
}

/** Render the saved insight library and mobile analytics insight builder. */
export function CustomInsightsPage({ organizationSlug, projectSlug }: CustomInsightsPageProps) {
  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(user, organizationSlug, projectSlug);
  const [authoring, setAuthoring] = useState(false);

  if (!project) {
    return <VoidhashErrorCard error={{ code: "NOT_FOUND", message: "Project not found" }} />;
  }

  return authoring ? (
    <InsightBuilder onClose={() => setAuthoring(false)} projectId={project.id} />
  ) : (
    <InsightLibrary onCreate={() => setAuthoring(true)} projectId={project.id} />
  );
}

function InsightLibrary({ onCreate, projectId }: { onCreate: () => void; projectId: string }) {
  const queryClient = useQueryClient();
  const insights = useQuery(listAnalyticsInsightsOptions({ projectId }));
  const deleteInsight = useMutation(deleteAnalyticsInsightOptions());
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string>();
  const removeInsight = (id: string) => {
    if (confirmingDeleteId !== id) {
      setConfirmingDeleteId(id);
      return;
    }
    deleteInsight.mutate(
      { id },
      {
        onSuccess: async () => {
          setConfirmingDeleteId(undefined);
          await queryClient.invalidateQueries({
            queryKey: queryKeys.analytics.insights({ projectId }),
          });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.analytics.dashboards({ projectId }),
          });
        },
      },
    );
  };

  return (
    <Page>
      <PageHeader
        rightActions={
          <Button onClick={onCreate}>
            <Plus />
            New insight
          </Button>
        }
      >
        <PageHeaderTitle>Insights</PageHeaderTitle>
      </PageHeader>
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
        <div>
          <h2 className="font-medium text-2xl tracking-tight">Product insights</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Build reusable analysis around the events that matter in your mobile app.
          </p>
        </div>
        {insights.isLoading ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
            Loading insights…
          </div>
        ) : insights.data?.insights.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {insights.data.insights.map((insight) => {
              const type = insightTypes.find((candidate) => candidate.kind === insight.kind);
              const Icon = type?.icon ?? ChartNoAxesCombined;
              return (
                <Card className="transition-colors hover:border-foreground/20" key={insight.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="rounded-lg bg-muted p-2">
                        <Icon className={type?.color} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground text-xs">
                          {type?.label ?? insight.kind}
                        </span>
                        <Button
                          aria-label={`${confirmingDeleteId === insight.id ? "Confirm deleting" : "Delete"} ${insight.name}`}
                          disabled={deleteInsight.isPending}
                          onClick={() => removeInsight(insight.id)}
                          size="icon"
                          title={
                            confirmingDeleteId === insight.id ? "Click again to confirm" : "Delete"
                          }
                          variant={confirmingDeleteId === insight.id ? "destructive" : "ghost"}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </div>
                    <CardTitle className="pt-3">{insight.name}</CardTitle>
                    <CardDescription>{insight.description || type?.description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        ) : (
          <button
            className="flex w-full flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center transition-colors hover:border-foreground/30 hover:bg-muted/30"
            onClick={onCreate}
            type="button"
          >
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <ChartSpline />
            </div>
            <span className="mt-4 font-medium">Create your first insight</span>
            <span className="mt-1 max-w-md text-muted-foreground text-sm">
              Start with a trend to understand event volume or active users over time.
            </span>
          </button>
        )}
        <CohortManager projectId={projectId} />
      </div>
    </Page>
  );
}

function CohortManager({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const cohorts = useQuery(listAnalyticsCohortsOptions({ projectId }));
  const people = useQuery(listPersonsOptions({ projectId }));
  const createCohort = useMutation(createAnalyticsCohortOptions());
  const deleteCohort = useMutation(deleteAnalyticsCohortOptions());
  const updateCohort = useMutation(updateAnalyticsCohortOptions());
  const [editingCohortId, setEditingCohortId] = useState<string>();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberPersonIds, setMemberPersonIds] = useState<string[]>([]);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics.cohorts({ projectId }) });

  const resetForm = () => {
    setDescription("");
    setEditingCohortId(undefined);
    setMemberPersonIds([]);
    setName("");
  };

  const saveCohort = () => {
    const onSuccess = async () => {
      resetForm();
      await refresh();
    };
    if (editingCohortId) {
      updateCohort.mutate(
        {
          description: description.trim() || null,
          id: editingCohortId,
          memberPersonIds,
          name: name.trim(),
        },
        { onSuccess },
      );
      return;
    }
    createCohort.mutate(
      {
        description: description.trim() || undefined,
        memberPersonIds,
        name: name.trim(),
        projectId,
      },
      { onSuccess },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Static cohorts</CardTitle>
        <CardDescription>
          Save a reusable set of people, then apply it to any insight from the audience bar.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <div className="space-y-3">
          {cohorts.data?.cohorts.length ? (
            cohorts.data.cohorts.map((cohort) => (
              <div
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
                key={cohort.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">{cohort.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {cohort.memberCount.toLocaleString()} people
                    {cohort.description ? ` · ${cohort.description}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    aria-label={`Edit ${cohort.name}`}
                    onClick={() => {
                      setDescription(cohort.description ?? "");
                      setEditingCohortId(cohort.id);
                      setMemberPersonIds([...cohort.memberPersonIds]);
                      setName(cohort.name);
                    }}
                    size="icon"
                    variant="ghost"
                  >
                    <Pencil size={15} />
                  </Button>
                  <Button
                    aria-label={`Delete ${cohort.name}`}
                    disabled={deleteCohort.isPending}
                    onClick={() =>
                      deleteCohort.mutate(
                        { id: cohort.id },
                        {
                          onSuccess: async () => {
                            if (editingCohortId === cohort.id) resetForm();
                            await refresh();
                          },
                        },
                      )
                    }
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
              No saved cohorts.
            </div>
          )}
        </div>
        <div className="space-y-3 rounded-lg border p-4">
          <div className="space-y-1.5">
            <Label htmlFor="cohort-name">Cohort name</Label>
            <Input
              id="cohort-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Beta testers"
              value={name}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cohort-description">Description</Label>
            <Input
              id="cohort-description"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional"
              value={description}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Members</Label>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
              {people.data?.length ? (
                people.data.map((person) => (
                  <label
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                    key={person.personId}
                  >
                    <Checkbox
                      checked={memberPersonIds.includes(person.personId)}
                      onCheckedChange={(checked) =>
                        setMemberPersonIds((current) =>
                          checked === true
                            ? [...new Set([...current, person.personId])]
                            : current.filter((id) => id !== person.personId),
                        )
                      }
                    />
                    <span className="truncate">
                      {person.name || person.email || person.distinctId}
                    </span>
                  </label>
                ))
              ) : (
                <p className="p-2 text-muted-foreground text-sm">No known people yet.</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {editingCohortId ? (
              <Button onClick={resetForm} variant="ghost">
                Cancel
              </Button>
            ) : null}
            <Button
              disabled={!name.trim() || createCohort.isPending || updateCohort.isPending}
              onClick={saveCohort}
            >
              {editingCohortId ? <Save /> : <Plus />}
              {updateCohort.isPending
                ? "Saving…"
                : createCohort.isPending
                  ? "Creating…"
                  : editingCohortId
                    ? "Save cohort"
                    : "Create cohort"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightBuilder({ onClose, projectId }: { onClose: () => void; projectId: string }) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<CustomAnalyticsInsightKindType>("trends");
  const [name, setName] = useState("Untitled insight");
  const [description, setDescription] = useState("");
  const [actorKind, setActorKind] = useState<"group" | "person">("person");
  const [groupProperty, setGroupProperty] = useState("organization_id");
  const [selectedCohortIds, setSelectedCohortIds] = useState<string[]>([]);
  const [series, setSeries] = useState<AuthoringSeries[]>([
    { aggregation: "unique_users", eventName: "$screen", key: "A" },
  ]);
  const [filterProperty, setFilterProperty] = useState("");
  const [filterOperator, setFilterOperator] = useState<"contains" | "eq" | "neq">("eq");
  const [filterValue, setFilterValue] = useState("");
  const [breakdownMode, setBreakdownMode] = useState<
    "event.name" | "none" | "person.id" | "property"
  >("none");
  const [breakdownProperty, setBreakdownProperty] = useState("");
  const [trendsComparison, setTrendsComparison] = useState<"none" | AnalyticsTrendsComparisonType>(
    "none",
  );
  const [trendsFormulaEnabled, setTrendsFormulaEnabled] = useState(false);
  const [trendsFormulas, setTrendsFormulas] = useState<AuthoringFormula[]>([
    { expression: "A", key: "formula-1", label: "" },
  ]);
  const [trendsDisplay, setTrendsDisplay] = useState<"area" | "bar" | "line" | "number">("line");
  const [trendsCumulative, setTrendsCumulative] = useState(false);
  const [trendsHideWeekends, setTrendsHideWeekends] = useState(false);
  const [trendsSmoothingWindow, setTrendsSmoothingWindow] = useState<1 | 7 | 14 | 28>(1);
  const [funnelSteps, setFunnelSteps] = useState<AuthoringFunnelStep[]>([
    { eventName: "paywall_viewed", key: "A" },
    { eventName: "purchase_completed", key: "B" },
  ]);
  const [funnelOrder, setFunnelOrder] = useState<FunnelsInsightQueryType["order"]>("sequential");
  const [funnelWindowDays, setFunnelWindowDays] = useState<1 | 7 | 14 | 30>(7);
  const [funnelBreakdownAttributionStep, setFunnelBreakdownAttributionStep] = useState(1);
  const [retentionStartEvent, setRetentionStartEvent] = useState("session_started");
  const [retentionReturningEvent, setRetentionReturningEvent] = useState("session_started");
  const [retentionType, setRetentionType] = useState<"first_time" | "recurring">("recurring");
  const [retentionPeriod, setRetentionPeriod] = useState<"day" | "month" | "week">("week");
  const [retentionIntervals, setRetentionIntervals] = useState<7 | 11 | 14>(11);
  const [retentionCumulative, setRetentionCumulative] = useState(false);
  const [retentionReference, setRetentionReference] = useState<"cohort" | "previous">("cohort");
  const [pathItem, setPathItem] = useState<"event_name" | "screen_name">("screen_name");
  const [pathEvents, setPathEvents] = useState("$screen");
  const [pathExcludedEvents, setPathExcludedEvents] = useState("");
  const [pathStart, setPathStart] = useState("");
  const [pathEnd, setPathEnd] = useState("");
  const [pathDepth, setPathDepth] = useState<3 | 5 | 8 | 12>(5);
  const [pathSessionMinutes, setPathSessionMinutes] = useState<15 | 30 | 60>(30);
  const [pathMinCount, setPathMinCount] = useState("");
  const [pathMaxCount, setPathMaxCount] = useState("");
  const [pathCollapseRepeated, setPathCollapseRepeated] = useState(true);
  const [stickinessComputation, setStickinessComputation] = useState<"cumulative" | "exact">(
    "exact",
  );
  const [stickinessDisplay, setStickinessDisplay] = useState<"bar" | "line">("bar");
  const [stickinessInterval, setStickinessInterval] = useState<"day" | "hour" | "month" | "week">(
    "day",
  );
  const [stickinessOccurrenceOperator, setStickinessOccurrenceOperator] = useState<
    "exact" | "gte" | "lte"
  >("gte");
  const [stickinessMinimum, setStickinessMinimum] = useState(1);
  const [lifecycleEvent, setLifecycleEvent] = useState("session_started");
  const [lifecycleDisplay, setLifecycleDisplay] = useState<"line" | "stacked_area">("stacked_area");
  const [lifecycleValueMode, setLifecycleValueMode] = useState<"count" | "percentage">("count");
  const [lifecycleStatuses, setLifecycleStatuses] = useState<
    Array<"dormant" | "new" | "resurrecting" | "returning">
  >(["new", "returning", "resurrecting", "dormant"]);
  const [granularity, setGranularity] = useState<"hour" | "day" | "week" | "month">("day");
  const [timeRange, setTimeRange] = useState<"last_7d" | "last_30d" | "last_90d">("last_7d");
  const runInsight = useMutation(queryCustomAnalyticsInsightOptions());
  const queryPeople = useMutation(queryCustomAnalyticsPersonsOptions());
  const [peopleDrilldownTitle, setPeopleDrilldownTitle] = useState("");
  const createInsight = useMutation(createAnalyticsInsightOptions());
  const cohorts = useQuery(listAnalyticsCohortsOptions({ projectId }));

  const definition = useMemo<CustomAnalyticsInsightQueryType>(() => {
    const audience = {
      ...(actorKind === "group"
        ? { actor: { kind: "group" as const, property: groupProperty.trim() } }
        : { actor: { kind: "person" as const } }),
      ...(selectedCohortIds.length ? { cohortIds: selectedCohortIds } : {}),
    };
    if (kind === "retention") {
      return {
        ...audience,
        cumulative: retentionCumulative,
        intervals: retentionIntervals,
        kind: "retention",
        period: retentionPeriod,
        reference: retentionReference,
        retentionType,
        returning: {
          aggregation: "unique_users",
          eventNames: [retentionReturningEvent.trim() || "session_started"],
          key: "returning",
          label: retentionReturningEvent.trim() || "session_started",
        },
        start: {
          aggregation: "unique_users",
          eventNames: [retentionStartEvent.trim() || "session_started"],
          key: "start",
          label: retentionStartEvent.trim() || "session_started",
        },
        timeRange: { preset: timeRange },
      };
    }
    if (kind === "funnels") {
      const funnelBreakdownField =
        breakdownMode === "property"
          ? breakdownProperty.trim()
            ? `event.properties.${breakdownProperty.trim()}`
            : undefined
          : breakdownMode === "none"
            ? undefined
            : breakdownMode;
      const [firstStep, ...remainingSteps] = funnelSteps;
      const toStep = (step: AuthoringFunnelStep) => ({
        eventNames: [step.eventName.trim() || "unnamed_event"] as [string, ...string[]],
        key: step.key,
        label: step.eventName.trim() || "Unnamed event",
      });
      return {
        ...audience,
        ...(funnelBreakdownField
          ? {
              breakdown: { field: funnelBreakdownField, limit: 10, order: "desc" as const },
              breakdownAttributionStep: Math.min(
                funnelBreakdownAttributionStep,
                funnelSteps.length,
              ),
            }
          : {}),
        conversionWindowSeconds: funnelWindowDays * 86_400,
        kind: "funnels",
        order: funnelOrder,
        steps: [
          toStep(firstStep ?? { eventName: "paywall_viewed", key: "A" }),
          ...remainingSteps.map(toStep),
        ],
        timeRange: { preset: timeRange },
      };
    }
    const filterField = filterProperty.trim();
    const breakdownField =
      breakdownMode === "property"
        ? breakdownProperty.trim()
          ? `event.properties.${breakdownProperty.trim()}`
          : undefined
        : breakdownMode === "none"
          ? undefined
          : breakdownMode;
    const toDefinitionSeries = (item: AuthoringSeries): AnalyticsEventSeriesType => ({
      aggregation: item.aggregation,
      eventNames: [item.eventName.trim() || "$screen"],
      ...(filterField && filterValue
        ? {
            filters: {
              field: `event.properties.${filterField}`,
              op: filterOperator,
              type: "predicate" as const,
              value: filterValue,
            },
          }
        : {}),
      key: item.key,
      label: item.eventName.trim() || "$screen",
      ...(item.aggregation.startsWith("property_") && item.mathProperty?.trim()
        ? { mathProperty: item.mathProperty.trim() }
        : {}),
    });
    const [firstSeries, ...remainingSeries] = series;
    const definitionSeries: [AnalyticsEventSeriesType, ...AnalyticsEventSeriesType[]] = [
      toDefinitionSeries(
        firstSeries ?? { aggregation: "unique_users", eventName: "$screen", key: "A" },
      ),
      ...remainingSeries.map(toDefinitionSeries),
    ];
    if (kind === "paths") {
      const eventNames = pathEvents
        .split(",")
        .map((eventName) => eventName.trim())
        .filter(Boolean);
      const excludeEventNames = pathExcludedEvents
        .split(",")
        .map((eventName) => eventName.trim())
        .filter(Boolean);
      const minimum = Number(pathMinCount);
      const maximum = Number(pathMaxCount);
      return {
        ...audience,
        collapseRepeated: pathCollapseRepeated,
        edgeLimit: 50,
        ...(pathEnd.trim() ? { endEventName: pathEnd.trim() } : {}),
        eventNames,
        ...(excludeEventNames.length ? { excludeEventNames } : {}),
        ...(filterField && filterValue
          ? {
              filters: {
                field: `event.properties.${filterField}`,
                op: filterOperator,
                type: "predicate" as const,
                value: filterValue,
              },
            }
          : {}),
        kind: "paths",
        maxDepth: pathDepth,
        ...(Number.isSafeInteger(maximum) && maximum > 0 ? { maxEdgeCount: maximum } : {}),
        ...(Number.isSafeInteger(minimum) && minimum > 0 ? { minEdgeCount: minimum } : {}),
        pathItem,
        sessionGapSeconds: pathSessionMinutes * 60,
        ...(pathStart.trim() ? { startEventName: pathStart.trim() } : {}),
        timeRange: { preset: timeRange },
      };
    }
    if (kind === "stickiness") {
      return {
        ...audience,
        computation: stickinessComputation,
        display: stickinessDisplay,
        interval: stickinessInterval,
        kind: "stickiness",
        occurrenceCriteria: {
          operator: stickinessOccurrenceOperator,
          value: stickinessMinimum,
        },
        series: definitionSeries.map((item) => ({
          ...item,
          aggregation: "unique_users" as const,
        })) as [AnalyticsEventSeriesType, ...AnalyticsEventSeriesType[]],
        timeRange: { preset: timeRange },
      };
    }
    if (kind === "lifecycle") {
      return {
        ...audience,
        display: lifecycleDisplay,
        granularity,
        kind: "lifecycle",
        series: {
          aggregation: "unique_users",
          eventNames: [lifecycleEvent.trim() || "session_started"],
          ...(filterField && filterValue
            ? {
                filters: {
                  field: `event.properties.${filterField}`,
                  op: filterOperator,
                  type: "predicate" as const,
                  value: filterValue,
                },
              }
            : {}),
          key: "lifecycle",
          label: lifecycleEvent.trim() || "session_started",
        },
        statuses: (lifecycleStatuses.length ? lifecycleStatuses : ["new"]) as [
          "dormant" | "new" | "resurrecting" | "returning",
          ...Array<"dormant" | "new" | "resurrecting" | "returning">,
        ],
        timeRange: { preset: timeRange },
        valueMode: lifecycleValueMode,
      };
    }
    return {
      ...audience,
      ...(breakdownField
        ? { breakdown: { field: breakdownField, limit: 10, order: "desc" as const } }
        : {}),
      ...(trendsDisplay !== "number" && trendsCumulative ? { cumulative: true } : {}),
      display: trendsDisplay,
      ...(trendsFormulaEnabled
        ? {
            formulas: trendsFormulas.map((formula) => ({
              expression: formula.expression.trim() || "A",
              key: formula.key,
              ...(formula.label.trim() ? { label: formula.label.trim() } : {}),
            })),
          }
        : {}),
      granularity,
      ...(trendsDisplay !== "number" && granularity === "day" && trendsHideWeekends
        ? { hideWeekends: true }
        : {}),
      kind: "trends",
      series: definitionSeries,
      ...(trendsDisplay !== "number" && granularity === "day" && trendsSmoothingWindow > 1
        ? { smoothingWindow: trendsSmoothingWindow }
        : {}),
      timeRange: { preset: timeRange },
      ...(trendsComparison === "none" ? {} : { comparison: trendsComparison }),
    };
  }, [
    actorKind,
    breakdownMode,
    breakdownProperty,
    filterOperator,
    filterProperty,
    filterValue,
    funnelBreakdownAttributionStep,
    funnelOrder,
    funnelSteps,
    funnelWindowDays,
    granularity,
    groupProperty,
    kind,
    lifecycleDisplay,
    lifecycleEvent,
    lifecycleStatuses,
    lifecycleValueMode,
    pathCollapseRepeated,
    pathDepth,
    pathEnd,
    pathEvents,
    pathExcludedEvents,
    pathItem,
    pathMaxCount,
    pathMinCount,
    pathSessionMinutes,
    pathStart,
    retentionCumulative,
    retentionIntervals,
    retentionPeriod,
    retentionReference,
    retentionReturningEvent,
    retentionStartEvent,
    retentionType,
    series,
    selectedCohortIds,
    stickinessComputation,
    stickinessDisplay,
    stickinessInterval,
    stickinessMinimum,
    stickinessOccurrenceOperator,
    timeRange,
    trendsComparison,
    trendsCumulative,
    trendsDisplay,
    trendsFormulaEnabled,
    trendsFormulas,
    trendsHideWeekends,
    trendsSmoothingWindow,
  ]);

  const updateSeries = (key: string, update: Partial<AuthoringSeries>) =>
    setSeries((current) =>
      current.map((item) => (item.key === key ? { ...item, ...update } : item)),
    );

  const openPeopleDrilldown = (input: {
    eventNames: readonly string[];
    filters?: AnalyticsEventSeriesType["filters"];
    group?: { property: string; value: string };
    label: string;
    range?: AnalyticsTimeRangeType;
  }) => {
    setPeopleDrilldownTitle(input.label);
    queryPeople.mutate({
      ...(definition.cohortIds ? { cohortIds: [...definition.cohortIds] } : {}),
      eventNames: [...input.eventNames] as [string, ...string[]],
      ...(input.filters ? { filters: input.filters } : {}),
      ...(input.group ? { group: input.group } : {}),
      limit: 50,
      projectId,
      timeRange: input.range ?? definition.timeRange,
    });
  };

  const updateFormula = (key: string, update: Partial<AuthoringFormula>) =>
    setTrendsFormulas((current) =>
      current.map((formula) => (formula.key === key ? { ...formula, ...update } : formula)),
    );

  const addFormula = () =>
    setTrendsFormulas((current) => {
      const index = Array.from({ length: 8 }, (_, candidate) => candidate + 1).find(
        (candidate) => !current.some((formula) => formula.key === `formula-${candidate}`),
      );
      return index
        ? [...current, { expression: "A", key: `formula-${index}`, label: "" }]
        : current;
    });

  const addSeries = () =>
    setSeries((current) => {
      const key = Array.from("ABCDEFGH").find(
        (candidate) => !current.some((item) => item.key === candidate),
      );
      return key ? [...current, { aggregation: "unique_users", eventName: "", key }] : current;
    });

  const updateFunnelStep = (key: string, eventName: string) =>
    setFunnelSteps((current) =>
      current.map((step) => (step.key === key ? { ...step, eventName } : step)),
    );

  const addFunnelStep = () =>
    setFunnelSteps((current) => {
      const key = Array.from("ABCDEFGH").find(
        (candidate) => !current.some((step) => step.key === candidate),
      );
      return key ? [...current, { eventName: "", key }] : current;
    });

  const onSave = () => {
    if (
      kind !== "trends" &&
      kind !== "funnels" &&
      kind !== "retention" &&
      kind !== "paths" &&
      kind !== "stickiness" &&
      kind !== "lifecycle"
    )
      return;
    createInsight.mutate(
      {
        definition,
        description: description.trim() || undefined,
        name: name.trim(),
        projectId,
      },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.analytics.insights({ projectId }),
          });
          onClose();
        },
      },
    );
  };

  const executable =
    (actorKind === "person" || groupProperty.trim().length > 0) &&
    (kind === "trends" ||
      kind === "funnels" ||
      kind === "retention" ||
      kind === "paths" ||
      kind === "stickiness" ||
      kind === "lifecycle");

  return (
    <Page className="flex h-[calc(100svh-var(--header-height))] flex-col overflow-hidden">
      <PageHeader
        rightActions={
          <div className="flex gap-2">
            <Button
              disabled={!executable || runInsight.isPending}
              onClick={() => runInsight.mutate({ definition, projectId })}
              variant="outline"
            >
              {runInsight.isPending ? "Running…" : "Run"}
            </Button>
            <Button
              disabled={!executable || !name.trim() || createInsight.isPending}
              onClick={onSave}
            >
              <Save />
              {createInsight.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-3">
          <Button aria-label="Back to insights" onClick={onClose} size="icon" variant="ghost">
            <ArrowLeft />
          </Button>
          <PageHeaderTitle>New insight</PageHeaderTitle>
        </div>
      </PageHeader>

      <div className="border-b px-4 py-3">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto">
          {insightTypes.map((type) => {
            const Icon = type.icon;
            return (
              <button
                className={`flex min-w-fit items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${kind === type.kind ? "border-primary bg-primary/5 text-foreground" : "border-transparent text-muted-foreground hover:bg-muted"}`}
                key={type.kind}
                onClick={() => setKind(type.kind)}
                type="button"
              >
                <Icon className={type.color} size={16} />
                {type.label}
                {!type.live ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">Next</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-b bg-muted/10 px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end gap-4">
          <div className="min-w-44 space-y-1.5">
            <Label>Aggregate by</Label>
            <Select
              onValueChange={(value) => setActorKind(value as "group" | "person")}
              value={actorKind}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="person">People</SelectItem>
                <SelectItem value="group">Mobile app group</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {actorKind === "group" ? (
            <div className="min-w-56 space-y-1.5">
              <Label htmlFor="analytics-group-property">Group property</Label>
              <Input
                id="analytics-group-property"
                onChange={(event) => setGroupProperty(event.target.value)}
                placeholder="organization_id or workspace_id"
                value={groupProperty}
              />
            </div>
          ) : null}
          <div className="min-w-64 flex-1 space-y-1.5">
            <Label>Static cohort filter</Label>
            <div className="flex min-h-9 flex-wrap items-center gap-2 rounded-md border bg-background px-3 py-2">
              {cohorts.data?.cohorts.length ? (
                cohorts.data.cohorts.map((cohort) => (
                  <label className="flex items-center gap-2 text-sm" key={cohort.id}>
                    <Checkbox
                      checked={selectedCohortIds.includes(cohort.id)}
                      onCheckedChange={(checked) =>
                        setSelectedCohortIds((current) =>
                          checked === true
                            ? [...new Set([...current, cohort.id])]
                            : current.filter((id) => id !== cohort.id),
                        )
                      }
                    />
                    <span>{cohort.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {cohort.memberCount.toLocaleString()}
                    </span>
                  </label>
                ))
              ) : (
                <span className="text-muted-foreground text-sm">
                  No cohorts yet. Create one from the insight library.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {kind === "trends" ? (
        <div className="grid min-h-0 flex-1 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="overflow-y-auto border-r bg-muted/20 p-4">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="insight-name">Name</Label>
                <Input
                  id="insight-name"
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="insight-description">Description</Label>
                <Textarea
                  id="insight-description"
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What question does this answer?"
                  value={description}
                />
              </div>
              {series.map((item) => (
                <Card key={item.key}>
                  <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm">Series {item.key}</CardTitle>
                    {series.length > 1 ? (
                      <Button
                        aria-label={`Remove series ${item.key}`}
                        onClick={() =>
                          setSeries((current) =>
                            current.filter((seriesItem) => seriesItem !== item),
                          )
                        }
                        size="icon"
                        variant="ghost"
                      >
                        <Trash2 size={15} />
                      </Button>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`event-name-${item.key}`}>Event name</Label>
                      <Input
                        id={`event-name-${item.key}`}
                        onChange={(event) =>
                          updateSeries(item.key, { eventName: event.target.value })
                        }
                        placeholder="$screen or checkout_started"
                        value={item.eventName}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Measure</Label>
                      <Select
                        onValueChange={(value) =>
                          updateSeries(item.key, {
                            aggregation: value as AuthoringSeries["aggregation"],
                            ...(value.startsWith("property_") && !item.mathProperty
                              ? { mathProperty: "value" }
                              : {}),
                          })
                        }
                        value={item.aggregation}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unique_users">Unique users</SelectItem>
                          <SelectItem value="total_events">Total events</SelectItem>
                          <SelectItem value="property_sum">Property sum</SelectItem>
                          <SelectItem value="property_average">Property average</SelectItem>
                          <SelectItem value="property_minimum">Property minimum</SelectItem>
                          <SelectItem value="property_maximum">Property maximum</SelectItem>
                          <SelectItem value="property_median">Property median</SelectItem>
                          <SelectItem value="property_p75">Property 75th percentile</SelectItem>
                          <SelectItem value="property_p90">Property 90th percentile</SelectItem>
                          <SelectItem value="property_p95">Property 95th percentile</SelectItem>
                          <SelectItem value="property_p99">Property 99th percentile</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {item.aggregation.startsWith("property_") ? (
                      <div className="space-y-2">
                        <Label htmlFor={`math-property-${item.key}`}>Numeric event property</Label>
                        <Input
                          id={`math-property-${item.key}`}
                          onChange={(event) =>
                            updateSeries(item.key, { mathProperty: event.target.value })
                          }
                          placeholder="duration_ms or revenue"
                          value={item.mathProperty ?? ""}
                        />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
              <Button disabled={series.length >= 8} onClick={addSeries} variant="outline">
                <Plus />
                Add series
              </Button>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Formula mode</CardTitle>
                  <CardDescription>
                    Derive a metric from series keys with safe arithmetic.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="flex items-start gap-3 text-sm">
                    <Checkbox
                      checked={trendsFormulaEnabled}
                      onCheckedChange={(checked) => setTrendsFormulaEnabled(checked === true)}
                    />
                    <span>
                      <span className="block font-medium">Show formula result</span>
                      <span className="text-muted-foreground text-xs">
                        Source series remain query inputs but the chart displays the derived series.
                      </span>
                    </span>
                  </label>
                  {trendsFormulaEnabled ? (
                    <>
                      {trendsFormulas.map((formula, index) => (
                        <div className="space-y-3 rounded-lg border p-3" key={formula.key}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm">Formula {index + 1}</span>
                            {trendsFormulas.length > 1 ? (
                              <Button
                                aria-label={`Remove formula ${index + 1}`}
                                onClick={() =>
                                  setTrendsFormulas((current) =>
                                    current.filter((candidate) => candidate.key !== formula.key),
                                  )
                                }
                                size="icon"
                                variant="ghost"
                              >
                                <Trash2 size={15} />
                              </Button>
                            ) : null}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`trends-formula-${formula.key}`}>Expression</Label>
                            <Input
                              id={`trends-formula-${formula.key}`}
                              onChange={(event) =>
                                updateFormula(formula.key, { expression: event.target.value })
                              }
                              placeholder="A / B * 100"
                              value={formula.expression}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`trends-formula-label-${formula.key}`}>Label</Label>
                            <Input
                              id={`trends-formula-label-${formula.key}`}
                              onChange={(event) =>
                                updateFormula(formula.key, { label: event.target.value })
                              }
                              placeholder="Conversion rate"
                              value={formula.label}
                            />
                          </div>
                        </div>
                      ))}
                      <Button
                        disabled={trendsFormulas.length >= 8}
                        onClick={addFormula}
                        variant="outline"
                      >
                        <Plus /> Add formula
                      </Button>
                      <p className="text-muted-foreground text-xs">
                        Supports +, −, ×, ÷, %, powers, and parentheses. Division by zero returns 0.
                      </p>
                    </>
                  ) : null}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Event property filter</CardTitle>
                  <CardDescription>
                    Applied to every series when both fields are set.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    onChange={(event) => setFilterProperty(event.target.value)}
                    placeholder="Property, e.g. plan"
                    value={filterProperty}
                  />
                  <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2">
                    <Select
                      onValueChange={(value) => setFilterOperator(value as typeof filterOperator)}
                      value={filterOperator}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eq">Equals</SelectItem>
                        <SelectItem value="neq">Not equal</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      onChange={(event) => setFilterValue(event.target.value)}
                      placeholder="Value"
                      value={filterValue}
                    />
                  </div>
                </CardContent>
              </Card>
              <div className="space-y-2">
                <Label>Break down by</Label>
                <Select
                  onValueChange={(value) => setBreakdownMode(value as typeof breakdownMode)}
                  value={breakdownMode}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No breakdown</SelectItem>
                    <SelectItem value="event.name">Event name</SelectItem>
                    <SelectItem value="person.id">Person</SelectItem>
                    <SelectItem value="property">Event property</SelectItem>
                  </SelectContent>
                </Select>
                {breakdownMode === "property" ? (
                  <Input
                    onChange={(event) => setBreakdownProperty(event.target.value)}
                    placeholder="Property, e.g. country"
                    value={breakdownProperty}
                  />
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Range</Label>
                  <Select
                    onValueChange={(value) => setTimeRange(value as typeof timeRange)}
                    value={timeRange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last_7d">Last 7 days</SelectItem>
                      <SelectItem value="last_30d">Last 30 days</SelectItem>
                      <SelectItem value="last_90d">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Grouped by</Label>
                  <Select
                    onValueChange={(value) => setGranularity(value as typeof granularity)}
                    value={granularity}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hour">Hour</SelectItem>
                      <SelectItem value="day">Day</SelectItem>
                      <SelectItem value="week">Week</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Visualization</Label>
                <Select
                  onValueChange={(value) => setTrendsDisplay(value as typeof trendsDisplay)}
                  value={trendsDisplay}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="line">Line</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="area">Area</SelectItem>
                    <SelectItem value="number">Total value</SelectItem>
                  </SelectContent>
                </Select>
                {trendsDisplay === "number" ? (
                  <p className="text-muted-foreground text-xs">
                    Aggregates each series across the full selected range.
                  </p>
                ) : null}
              </div>
              {trendsDisplay !== "number" ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Time-series options</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <label className="flex items-start gap-3 text-sm">
                      <Checkbox
                        checked={trendsCumulative}
                        onCheckedChange={(checked) => setTrendsCumulative(checked === true)}
                      />
                      <span>
                        <span className="block font-medium">Cumulative</span>
                        <span className="text-muted-foreground text-xs">
                          Add each bucket to the running total.
                        </span>
                      </span>
                    </label>
                    {granularity === "day" ? (
                      <>
                        <label className="flex items-start gap-3 text-sm">
                          <Checkbox
                            checked={trendsHideWeekends}
                            onCheckedChange={(checked) => setTrendsHideWeekends(checked === true)}
                          />
                          <span>
                            <span className="block font-medium">Hide weekends</span>
                            <span className="text-muted-foreground text-xs">
                              Remove Saturday and Sunday buckets after calculations.
                            </span>
                          </span>
                        </label>
                        <div className="space-y-2">
                          <Label>Smoothing</Label>
                          <Select
                            onValueChange={(value) =>
                              setTrendsSmoothingWindow(
                                Number(value) as typeof trendsSmoothingWindow,
                              )
                            }
                            value={String(trendsSmoothingWindow)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">None</SelectItem>
                              <SelectItem value="7">7-day trailing average</SelectItem>
                              <SelectItem value="14">14-day trailing average</SelectItem>
                              <SelectItem value="28">28-day trailing average</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}
              <div className="space-y-2">
                <Label>Compare with</Label>
                <Select
                  onValueChange={(value) => setTrendsComparison(value as typeof trendsComparison)}
                  value={trendsComparison}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No comparison</SelectItem>
                    <SelectItem value="previous_period">Previous period</SelectItem>
                    <SelectItem value="previous_year">Previous year</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Overlay an equal historical window on the current timeline.
                </p>
              </div>
            </div>
          </aside>
          <InsightPreview
            display={trendsDisplay}
            onDrilldown={(seriesKey) => {
              if (definition.kind !== "trends") return;
              const selected = definition.series.find((item) => item.key === seriesKey);
              if (!selected) return;
              openPeopleDrilldown({
                eventNames: selected.eventNames,
                filters: selected.filters,
                label: selected.label ?? selected.eventNames.join(" or "),
              });
            }}
            people={queryPeople.data}
            peopleError={queryPeople.error}
            peoplePending={queryPeople.isPending}
            peopleTitle={peopleDrilldownTitle}
            result={runInsight.data}
            sourceSeriesKeys={
              definition.kind === "trends" ? definition.series.map((item) => item.key) : []
            }
          />
        </div>
      ) : kind === "funnels" ? (
        <div className="grid min-h-0 flex-1 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="overflow-y-auto border-r bg-muted/20 p-4">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="funnel-name">Name</Label>
                <Input
                  id="funnel-name"
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="funnel-description">Description</Label>
                <Textarea
                  id="funnel-description"
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Which mobile flow does this measure?"
                  value={description}
                />
              </div>
              <div className="space-y-3">
                {funnelSteps.map((step, index) => (
                  <Card key={step.key}>
                    <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                      <CardTitle className="text-sm">Step {index + 1}</CardTitle>
                      {funnelSteps.length > 2 ? (
                        <Button
                          aria-label={`Remove funnel step ${index + 1}`}
                          onClick={() =>
                            setFunnelSteps((current) =>
                              current.filter((candidate) => candidate !== step),
                            )
                          }
                          size="icon"
                          variant="ghost"
                        >
                          <Trash2 size={15} />
                        </Button>
                      ) : null}
                    </CardHeader>
                    <CardContent>
                      <Input
                        aria-label={`Event for funnel step ${index + 1}`}
                        onChange={(event) => updateFunnelStep(step.key, event.target.value)}
                        placeholder="Event name"
                        value={step.eventName}
                      />
                    </CardContent>
                  </Card>
                ))}
                <Button
                  disabled={funnelSteps.length >= 8}
                  onClick={addFunnelStep}
                  variant="outline"
                >
                  <Plus /> Add step
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Step order</Label>
                <Select
                  onValueChange={(value) => setFunnelOrder(value as typeof funnelOrder)}
                  value={funnelOrder}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sequential">Sequential</SelectItem>
                    <SelectItem value="strict">Strict adjacency</SelectItem>
                    <SelectItem value="any">Any order</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  {funnelOrder === "strict"
                    ? "Each step must be the next event the person performs."
                    : funnelOrder === "any"
                      ? "Steps may happen in any sequence within the window."
                      : "Steps stay ordered, while unrelated events may happen between them."}
                </p>
              </div>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Breakdown attribution</CardTitle>
                  <CardDescription>
                    Compare funnels by the earliest value seen at a selected step.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select
                    onValueChange={(value) => setBreakdownMode(value as typeof breakdownMode)}
                    value={breakdownMode}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No breakdown</SelectItem>
                      <SelectItem value="event.name">Event name</SelectItem>
                      <SelectItem value="person.id">Person identity</SelectItem>
                      <SelectItem value="property">Event property</SelectItem>
                    </SelectContent>
                  </Select>
                  {breakdownMode === "property" ? (
                    <Input
                      onChange={(event) => setBreakdownProperty(event.target.value)}
                      placeholder="Property, e.g. platform"
                      value={breakdownProperty}
                    />
                  ) : null}
                  {breakdownMode !== "none" ? (
                    <div className="space-y-2">
                      <Label>Attribute from step</Label>
                      <Select
                        onValueChange={(value) => setFunnelBreakdownAttributionStep(Number(value))}
                        value={String(Math.min(funnelBreakdownAttributionStep, funnelSteps.length))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {funnelSteps.map((step, index) => (
                            <SelectItem key={step.key} value={String(index + 1)}>
                              Step {index + 1}: {step.eventName || "Unnamed event"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Conversion window</Label>
                  <Select
                    onValueChange={(value) =>
                      setFunnelWindowDays(Number(value) as typeof funnelWindowDays)
                    }
                    value={String(funnelWindowDays)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Range</Label>
                  <Select
                    onValueChange={(value) => setTimeRange(value as typeof timeRange)}
                    value={timeRange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last_7d">Last 7 days</SelectItem>
                      <SelectItem value="last_30d">Last 30 days</SelectItem>
                      <SelectItem value="last_90d">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </aside>
          <FunnelPreview
            onDrilldown={(stepIndex, breakdownValue) => {
              if (definition.kind !== "funnels") return;
              const selected = definition.steps[stepIndex];
              if (!selected) return;
              const breakdownField = definition.breakdown?.field;
              openPeopleDrilldown({
                eventNames: selected.eventNames,
                filters: selected.filters,
                ...(breakdownValue !== undefined && breakdownField?.startsWith("event.properties.")
                  ? {
                      group: {
                        property: breakdownField.slice("event.properties.".length),
                        value: breakdownValue,
                      },
                    }
                  : {}),
                label: `${selected.label ?? selected.eventNames.join(" or ")} · funnel step ${stepIndex + 1}`,
              });
            }}
            people={queryPeople.data}
            peopleError={queryPeople.error}
            peoplePending={queryPeople.isPending}
            peopleTitle={peopleDrilldownTitle}
            result={runInsight.data}
          />
        </div>
      ) : kind === "retention" ? (
        <div className="grid min-h-0 flex-1 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="overflow-y-auto border-r bg-muted/20 p-4">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="retention-name">Name</Label>
                <Input
                  id="retention-name"
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retention-description">Description</Label>
                <Textarea
                  id="retention-description"
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Which returning behavior does this measure?"
                  value={description}
                />
              </div>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Cohort event</CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    onChange={(event) => setRetentionStartEvent(event.target.value)}
                    placeholder="session_started"
                    value={retentionStartEvent}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Returning event</CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    onChange={(event) => setRetentionReturningEvent(event.target.value)}
                    placeholder="session_started"
                    value={retentionReturningEvent}
                  />
                </CardContent>
              </Card>
              <div className="space-y-2">
                <Label>Cohort membership</Label>
                <Select
                  onValueChange={(value) => setRetentionType(value as typeof retentionType)}
                  value={retentionType}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recurring">Recurring</SelectItem>
                    <SelectItem value="first_time">First time</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  {retentionType === "first_time"
                    ? "A person joins only the cohort of their first matching event."
                    : "A person can join every period in which they perform the cohort event."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Period</Label>
                  <Select
                    onValueChange={(value) => setRetentionPeriod(value as typeof retentionPeriod)}
                    value={retentionPeriod}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Day</SelectItem>
                      <SelectItem value="week">Week</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Intervals</Label>
                  <Select
                    onValueChange={(value) =>
                      setRetentionIntervals(Number(value) as typeof retentionIntervals)
                    }
                    value={String(retentionIntervals)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7</SelectItem>
                      <SelectItem value="11">11</SelectItem>
                      <SelectItem value="14">14</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Rate reference</Label>
                <Select
                  onValueChange={(value) =>
                    setRetentionReference(value as typeof retentionReference)
                  }
                  value={retentionReference}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cohort">Initial cohort</SelectItem>
                    <SelectItem value="previous">Previous period</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                <Checkbox
                  checked={retentionCumulative}
                  onCheckedChange={(checked) => setRetentionCumulative(checked === true)}
                />
                <span>
                  <span className="block font-medium">Rolling retention</span>
                  <span className="text-muted-foreground text-xs">
                    A later return also counts toward earlier intervals.
                  </span>
                </span>
              </label>
              <div className="space-y-2">
                <Label>Range</Label>
                <Select
                  onValueChange={(value) => setTimeRange(value as typeof timeRange)}
                  value={timeRange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last_7d">Last 7 days</SelectItem>
                    <SelectItem value="last_30d">Last 30 days</SelectItem>
                    <SelectItem value="last_90d">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </aside>
          <RetentionPreview
            onDrilldown={(interval) => {
              if (definition.kind !== "retention") return;
              const selected = interval === 0 ? definition.start : definition.returning;
              openPeopleDrilldown({
                eventNames: selected.eventNames,
                filters: selected.filters,
                label: `${selected.label ?? selected.eventNames.join(" or ")} · retention interval ${interval}`,
              });
            }}
            people={queryPeople.data}
            peopleError={queryPeople.error}
            peoplePending={queryPeople.isPending}
            peopleTitle={peopleDrilldownTitle}
            result={runInsight.data}
          />
        </div>
      ) : kind === "paths" ? (
        <div className="grid min-h-0 flex-1 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="overflow-y-auto border-r bg-muted/20 p-4">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="paths-name">Name</Label>
                <Input
                  id="paths-name"
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paths-description">Description</Label>
                <Textarea
                  id="paths-description"
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Which journey through the app are you exploring?"
                  value={description}
                />
              </div>
              <div className="space-y-2">
                <Label>Path steps</Label>
                <Select
                  onValueChange={(value) => setPathItem(value as typeof pathItem)}
                  value={pathItem}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="screen_name">Mobile screen names</SelectItem>
                    <SelectItem value="event_name">Event names</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Screen paths read $screen_name, while event paths use the captured event name.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paths-events">Included event names</Label>
                <Input
                  id="paths-events"
                  onChange={(event) => setPathEvents(event.target.value)}
                  placeholder="$screen, checkout_started (blank means all)"
                  value={pathEvents}
                />
                <p className="text-muted-foreground text-xs">
                  Separate multiple events with commas.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="paths-start">Start at</Label>
                  <Input
                    id="paths-start"
                    onChange={(event) => setPathStart(event.target.value)}
                    placeholder="Any step"
                    value={pathStart}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paths-end">End at</Label>
                  <Input
                    id="paths-end"
                    onChange={(event) => setPathEnd(event.target.value)}
                    placeholder="Any step"
                    value={pathEnd}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paths-excluded">Excluded path items</Label>
                <Input
                  id="paths-excluded"
                  onChange={(event) => setPathExcludedEvents(event.target.value)}
                  placeholder="app_backgrounded, heartbeat"
                  value={pathExcludedEvents}
                />
              </div>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Event property filter</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    onChange={(event) => setFilterProperty(event.target.value)}
                    placeholder="Property, e.g. platform"
                    value={filterProperty}
                  />
                  <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2">
                    <Select
                      onValueChange={(value) => setFilterOperator(value as typeof filterOperator)}
                      value={filterOperator}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eq">Equals</SelectItem>
                        <SelectItem value="neq">Not equal</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      onChange={(event) => setFilterValue(event.target.value)}
                      placeholder="Value"
                      value={filterValue}
                    />
                  </div>
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Visible steps</Label>
                  <Select
                    onValueChange={(value) => setPathDepth(Number(value) as typeof pathDepth)}
                    value={String(pathDepth)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 steps</SelectItem>
                      <SelectItem value="5">5 steps</SelectItem>
                      <SelectItem value="8">8 steps</SelectItem>
                      <SelectItem value="12">12 steps</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Session gap</Label>
                  <Select
                    onValueChange={(value) =>
                      setPathSessionMinutes(Number(value) as typeof pathSessionMinutes)
                    }
                    value={String(pathSessionMinutes)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="paths-min-count">Minimum transitions</Label>
                  <Input
                    id="paths-min-count"
                    min={1}
                    onChange={(event) => setPathMinCount(event.target.value)}
                    placeholder="Any"
                    type="number"
                    value={pathMinCount}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paths-max-count">Maximum transitions</Label>
                  <Input
                    id="paths-max-count"
                    min={1}
                    onChange={(event) => setPathMaxCount(event.target.value)}
                    placeholder="Any"
                    type="number"
                    value={pathMaxCount}
                  />
                </div>
              </div>
              <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                <Checkbox
                  checked={pathCollapseRepeated}
                  onCheckedChange={(checked) => setPathCollapseRepeated(checked === true)}
                />
                <span>
                  <span className="block font-medium">Collapse repeated steps</span>
                  <span className="text-muted-foreground text-xs">
                    Consecutive visits to the same screen or event become one step.
                  </span>
                </span>
              </label>
              <div className="space-y-2">
                <Label>Range</Label>
                <Select
                  onValueChange={(value) => setTimeRange(value as typeof timeRange)}
                  value={timeRange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last_7d">Last 7 days</SelectItem>
                    <SelectItem value="last_30d">Last 30 days</SelectItem>
                    <SelectItem value="last_90d">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </aside>
          <PathsPreview
            onDrilldown={(pathItem) => {
              if (definition.kind !== "paths") return;
              const screenFilter: AnalyticsEventSeriesType["filters"] = {
                field: "event.properties.$screen_name",
                op: "eq",
                type: "predicate",
                value: pathItem,
              };
              openPeopleDrilldown({
                eventNames:
                  definition.pathItem === "event_name"
                    ? [pathItem]
                    : definition.eventNames.length
                      ? definition.eventNames
                      : ["$screen"],
                filters:
                  definition.pathItem === "event_name"
                    ? definition.filters
                    : definition.filters
                      ? { filters: [definition.filters, screenFilter], type: "and" }
                      : screenFilter,
                label: `${pathItem} · path step`,
              });
            }}
            people={queryPeople.data}
            peopleError={queryPeople.error}
            peoplePending={queryPeople.isPending}
            peopleTitle={peopleDrilldownTitle}
            result={runInsight.data}
          />
        </div>
      ) : kind === "stickiness" ? (
        <div className="grid min-h-0 flex-1 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="overflow-y-auto border-r bg-muted/20 p-4">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="stickiness-name">Name</Label>
                <Input
                  id="stickiness-name"
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stickiness-description">Description</Label>
                <Textarea
                  id="stickiness-description"
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Which habit or repeated behavior does this measure?"
                  value={description}
                />
              </div>
              {series.map((item) => (
                <Card key={item.key}>
                  <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm">Series {item.key}</CardTitle>
                    {series.length > 1 ? (
                      <Button
                        aria-label={`Remove series ${item.key}`}
                        onClick={() =>
                          setSeries((current) => current.filter((candidate) => candidate !== item))
                        }
                        size="icon"
                        variant="ghost"
                      >
                        <Trash2 size={15} />
                      </Button>
                    ) : null}
                  </CardHeader>
                  <CardContent>
                    <Input
                      onChange={(event) =>
                        updateSeries(item.key, { eventName: event.target.value })
                      }
                      placeholder="$screen or session_started"
                      value={item.eventName}
                    />
                  </CardContent>
                </Card>
              ))}
              <Button disabled={series.length >= 8} onClick={addSeries} variant="outline">
                <Plus /> Add series
              </Button>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Event property filter</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    onChange={(event) => setFilterProperty(event.target.value)}
                    placeholder="Property, e.g. screen"
                    value={filterProperty}
                  />
                  <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2">
                    <Select
                      onValueChange={(value) => setFilterOperator(value as typeof filterOperator)}
                      value={filterOperator}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eq">Equals</SelectItem>
                        <SelectItem value="neq">Not equal</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      onChange={(event) => setFilterValue(event.target.value)}
                      placeholder="Value"
                      value={filterValue}
                    />
                  </div>
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    onValueChange={(value) =>
                      setStickinessComputation(value as typeof stickinessComputation)
                    }
                    value={stickinessComputation}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exact">Exactly N intervals</SelectItem>
                      <SelectItem value="cumulative">At least N intervals</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Interval</Label>
                  <Select
                    onValueChange={(value) =>
                      setStickinessInterval(value as typeof stickinessInterval)
                    }
                    value={stickinessInterval}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hour">Hour</SelectItem>
                      <SelectItem value="day">Day</SelectItem>
                      <SelectItem value="week">Week</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stickiness-minimum">Events per interval</Label>
                <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-2">
                  <Select
                    onValueChange={(value) =>
                      setStickinessOccurrenceOperator(value as typeof stickinessOccurrenceOperator)
                    }
                    value={stickinessOccurrenceOperator}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gte">At least</SelectItem>
                      <SelectItem value="exact">Exactly</SelectItem>
                      <SelectItem value="lte">At most</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="stickiness-minimum"
                    min={1}
                    onChange={(event) =>
                      setStickinessMinimum(Math.max(1, Number(event.target.value) || 1))
                    }
                    type="number"
                    value={stickinessMinimum}
                  />
                </div>
                <p className="text-muted-foreground text-xs">
                  Count an interval only when the person&apos;s event volume matches this rule.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Visualization</Label>
                <Select
                  onValueChange={(value) => setStickinessDisplay(value as typeof stickinessDisplay)}
                  value={stickinessDisplay}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Bar chart</SelectItem>
                    <SelectItem value="line">Line chart</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Range</Label>
                <Select
                  onValueChange={(value) => setTimeRange(value as typeof timeRange)}
                  value={timeRange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last_7d">Last 7 days</SelectItem>
                    <SelectItem value="last_30d">Last 30 days</SelectItem>
                    <SelectItem value="last_90d">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </aside>
          <StickinessPreview
            display={stickinessDisplay}
            onDrilldown={(seriesKey) => {
              if (definition.kind !== "stickiness") return;
              const selected = definition.series.find((item) => item.key === seriesKey);
              if (!selected) return;
              openPeopleDrilldown({
                eventNames: selected.eventNames,
                filters: selected.filters,
                label: `${selected.label ?? selected.eventNames.join(" or ")} · stickiness`,
              });
            }}
            people={queryPeople.data}
            peopleError={queryPeople.error}
            peoplePending={queryPeople.isPending}
            peopleTitle={peopleDrilldownTitle}
            result={runInsight.data}
          />
        </div>
      ) : kind === "lifecycle" ? (
        <div className="grid min-h-0 flex-1 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="overflow-y-auto border-r bg-muted/20 p-4">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="lifecycle-name">Name</Label>
                <Input
                  id="lifecycle-name"
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lifecycle-description">Description</Label>
                <Textarea
                  id="lifecycle-description"
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="How is this behavior's active audience changing?"
                  value={description}
                />
              </div>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Lifecycle event</CardTitle>
                  <CardDescription>
                    People are classified from their activity for this event.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Input
                    onChange={(event) => setLifecycleEvent(event.target.value)}
                    placeholder="session_started"
                    value={lifecycleEvent}
                  />
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Period</Label>
                  <Select
                    onValueChange={(value) => setGranularity(value as typeof granularity)}
                    value={granularity}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hour">Hour</SelectItem>
                      <SelectItem value="day">Day</SelectItem>
                      <SelectItem value="week">Week</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Visualization</Label>
                  <Select
                    onValueChange={(value) => setLifecycleDisplay(value as typeof lifecycleDisplay)}
                    value={lifecycleDisplay}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stacked_area">Stacked area</SelectItem>
                      <SelectItem value="line">Lines</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Visible groups</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  {(["new", "returning", "resurrecting", "dormant"] as const).map((status) => (
                    <label className="flex items-center gap-2 text-sm capitalize" key={status}>
                      <Checkbox
                        checked={lifecycleStatuses.includes(status)}
                        onCheckedChange={(checked) =>
                          setLifecycleStatuses((current) =>
                            checked === true
                              ? current.includes(status)
                                ? current
                                : [...current, status]
                              : current.length > 1
                                ? current.filter((candidate) => candidate !== status)
                                : current,
                          )
                        }
                      />
                      {status}
                    </label>
                  ))}
                </CardContent>
              </Card>
              <div className="space-y-2">
                <Label>Values</Label>
                <Select
                  onValueChange={(value) =>
                    setLifecycleValueMode(value as typeof lifecycleValueMode)
                  }
                  value={lifecycleValueMode}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="count">People</SelectItem>
                    <SelectItem value="percentage">Percentage of lifecycle movement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Event property filter</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    onChange={(event) => setFilterProperty(event.target.value)}
                    placeholder="Property, e.g. platform"
                    value={filterProperty}
                  />
                  <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2">
                    <Select
                      onValueChange={(value) => setFilterOperator(value as typeof filterOperator)}
                      value={filterOperator}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eq">Equals</SelectItem>
                        <SelectItem value="neq">Not equal</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      onChange={(event) => setFilterValue(event.target.value)}
                      placeholder="Value"
                      value={filterValue}
                    />
                  </div>
                </CardContent>
              </Card>
              <div className="space-y-2">
                <Label>Range</Label>
                <Select
                  onValueChange={(value) => setTimeRange(value as typeof timeRange)}
                  value={timeRange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last_7d">Last 7 days</SelectItem>
                    <SelectItem value="last_30d">Last 30 days</SelectItem>
                    <SelectItem value="last_90d">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </aside>
          <LifecyclePreview
            display={lifecycleDisplay}
            onDrilldown={() => {
              if (definition.kind !== "lifecycle") return;
              openPeopleDrilldown({
                eventNames: definition.series.eventNames,
                filters: definition.series.filters,
                label: definition.series.label ?? definition.series.eventNames.join(" or "),
              });
            }}
            people={queryPeople.data}
            peopleError={queryPeople.error}
            peoplePending={queryPeople.isPending}
            peopleTitle={peopleDrilldownTitle}
            result={runInsight.data}
            valueMode={lifecycleValueMode}
          />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-8">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>{insightTypes.find((type) => type.kind === kind)?.label}</CardTitle>
              <CardDescription>
                The typed definition and persistence model for this insight are in place. Query
                execution and its dedicated mobile-first controls are the next implementation slice.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}
    </Page>
  );
}

function PeopleDrilldown({
  error,
  pending,
  result,
  title,
}: {
  error: unknown;
  pending: boolean;
  result?: QueryCustomAnalyticsPersonsResponseType;
  title: string;
}) {
  if (!pending && !error && !result) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>People · {title || "selected result"}</CardTitle>
        <CardDescription>
          {pending
            ? "Loading matching people…"
            : result
              ? `${result.people.length} matching people shown, ordered by recent activity.`
              : "The people drilldown could not be loaded."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive text-sm">
            {error instanceof Error ? error.message : "Unable to query matching people"}
          </div>
        ) : result?.people.length ? (
          <div className="divide-y rounded-lg border">
            {result.people.map((person) => (
              <div
                className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4"
                key={person.personId}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {person.name || person.email || person.personId}
                  </p>
                  <p className="truncate text-muted-foreground text-xs">{person.personId}</p>
                </div>
                <span className="text-muted-foreground tabular-nums">
                  {person.eventCount.toLocaleString()} events
                </span>
                <span className="text-muted-foreground text-xs">
                  {person.lastSeenAt.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : pending ? null : (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
            No identified people matched this segment.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InsightPreview({
  display,
  onDrilldown,
  people,
  peopleError,
  peoplePending,
  peopleTitle,
  result,
  sourceSeriesKeys,
}: {
  display: "area" | "bar" | "line" | "number";
  onDrilldown: (seriesKey: string) => void;
  people?: QueryCustomAnalyticsPersonsResponseType;
  peopleError: unknown;
  peoplePending: boolean;
  peopleTitle: string;
  result?: QueryCustomAnalyticsInsightResponseType;
  sourceSeriesKeys: readonly string[];
}) {
  const trendsResult = result?.kind === "trends" ? result : undefined;
  const palette = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];
  const pointsByDate = new Map<string, Record<string, number | string>>();
  for (const series of trendsResult?.series ?? []) {
    for (const point of series.points) {
      const date = point.timestamp.toISOString();
      const row = pointsByDate.get(date) ?? { date };
      row[series.key] = point.value;
      pointsByDate.set(date, row);
    }
  }
  const points = [...pointsByDate.values()].sort((left, right) =>
    String(left.date).localeCompare(String(right.date)),
  );
  const colorByBaseKey = new Map<string, string>();
  const seriesColors = new Map<string, string>();
  for (const series of trendsResult?.series ?? []) {
    const baseKey = series.key.split(":comparison:")[0] ?? series.key;
    const color =
      colorByBaseKey.get(baseKey) ??
      palette[colorByBaseKey.size % palette.length] ??
      "var(--chart-1)";
    colorByBaseKey.set(baseKey, color);
    seriesColors.set(series.key, color);
  }
  const config = Object.fromEntries(
    (trendsResult?.series ?? []).map((series) => [
      series.key,
      { color: seriesColors.get(series.key) ?? "var(--chart-1)", label: series.label },
    ]),
  ) satisfies ChartConfig;

  return (
    <main className="min-w-0 space-y-4 overflow-y-auto p-4 lg:p-6">
      <Card className="min-h-[480px]">
        <CardHeader>
          <CardTitle>Trend preview</CardTitle>
          <CardDescription>
            {trendsResult
              ? display === "number"
                ? `${trendsResult.series.length} total value${trendsResult.series.length === 1 ? "" : "s"} returned`
                : `${points.length} time buckets returned${trendsResult.comparisonTimeRange ? " with a comparison overlay" : ""}`
              : "Run the insight to preview real project data."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {display === "number" && trendsResult?.series.some((series) => series.points.length) ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {trendsResult.series.map((series) => (
                <div className="rounded-xl border bg-muted/20 p-5" key={series.key}>
                  <p className="truncate text-muted-foreground text-sm">{series.label}</p>
                  <p className="mt-2 font-semibold text-3xl tabular-nums tracking-tight">
                    {(series.points[0]?.value ?? 0).toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              ))}
            </div>
          ) : points.length ? (
            <ChartContainer className="h-[360px] w-full" config={config}>
              {display === "bar" ? (
                <BarChart accessibilityLayer data={points} margin={{ left: 8, right: 20 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="date"
                    tickFormatter={(value: string) =>
                      new Date(value).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })
                    }
                    tickLine={false}
                    tickMargin={10}
                  />
                  <YAxis axisLine={false} tickLine={false} width={42} />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
                  {(trendsResult?.series ?? []).map((series) => (
                    <Bar
                      dataKey={series.key}
                      fill={seriesColors.get(series.key) ?? "var(--chart-1)"}
                      fillOpacity={
                        series.comparison && series.comparison !== "current" ? 0.4 : 0.85
                      }
                      key={series.key}
                      radius={3}
                    />
                  ))}
                </BarChart>
              ) : display === "area" ? (
                <AreaChart accessibilityLayer data={points} margin={{ left: 8, right: 20 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="date"
                    tickFormatter={(value: string) =>
                      new Date(value).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })
                    }
                    tickLine={false}
                    tickMargin={10}
                  />
                  <YAxis axisLine={false} tickLine={false} width={42} />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
                  {(trendsResult?.series ?? []).map((series) => (
                    <Area
                      dataKey={series.key}
                      fill={seriesColors.get(series.key) ?? "var(--chart-1)"}
                      fillOpacity={
                        series.comparison && series.comparison !== "current" ? 0.08 : 0.18
                      }
                      key={series.key}
                      stroke={seriesColors.get(series.key) ?? "var(--chart-1)"}
                      strokeDasharray={
                        series.comparison && series.comparison !== "current" ? "6 5" : undefined
                      }
                      strokeWidth={2}
                      type="monotone"
                    />
                  ))}
                </AreaChart>
              ) : (
                <LineChart accessibilityLayer data={points} margin={{ left: 8, right: 20 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="date"
                    tickFormatter={(value: string) =>
                      new Date(value).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })
                    }
                    tickLine={false}
                    tickMargin={10}
                  />
                  <YAxis axisLine={false} tickLine={false} width={42} />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
                  {(trendsResult?.series ?? []).map((series) => (
                    <Line
                      dataKey={series.key}
                      dot={false}
                      key={series.key}
                      stroke={seriesColors.get(series.key) ?? "var(--chart-1)"}
                      strokeDasharray={
                        series.comparison && series.comparison !== "current" ? "6 5" : undefined
                      }
                      strokeWidth={2.5}
                      type="monotone"
                    />
                  ))}
                </LineChart>
              )}
            </ChartContainer>
          ) : (
            <div className="flex h-[360px] items-center justify-center rounded-xl border border-dashed bg-muted/20 text-center">
              <div>
                <ChartSpline className="mx-auto text-muted-foreground" />
                <p className="mt-3 text-sm">Your trend will appear here</p>
              </div>
            </div>
          )}
          {trendsResult ? (
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
              {sourceSeriesKeys.map((key) => {
                const selected = trendsResult.series.find(
                  (item) => item.key === key && (!item.comparison || item.comparison === "current"),
                );
                return (
                  <Button key={key} onClick={() => onDrilldown(key)} size="sm" variant="outline">
                    View people · {selected?.label ?? key}
                  </Button>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <PeopleDrilldown
        error={peopleError}
        pending={peoplePending}
        result={people}
        title={peopleTitle}
      />
    </main>
  );
}

function FunnelPreview({
  onDrilldown,
  people,
  peopleError,
  peoplePending,
  peopleTitle,
  result,
}: {
  onDrilldown: (stepIndex: number, breakdownValue?: string) => void;
  people?: QueryCustomAnalyticsPersonsResponseType;
  peopleError: unknown;
  peoplePending: boolean;
  peopleTitle: string;
  result?: QueryCustomAnalyticsInsightResponseType;
}) {
  const funnelResult = result?.kind === "funnels" ? result : undefined;
  const [selectedBreakdownKey, setSelectedBreakdownKey] = useState("overall");
  const selectedBreakdown = funnelResult?.breakdowns?.find(
    (group) => `group:${group.breakdownValue}` === selectedBreakdownKey,
  );
  const displayedSteps = selectedBreakdown?.steps ?? funnelResult?.steps;
  const displayedConversionRate =
    selectedBreakdown?.totalConversionRate ?? funnelResult?.totalConversionRate;
  return (
    <main className="min-w-0 space-y-4 overflow-y-auto p-4 lg:p-6">
      <Card className="min-h-[480px]">
        <CardHeader>
          <CardTitle>Funnel preview</CardTitle>
          <CardDescription>
            {funnelResult
              ? `${((displayedConversionRate ?? 0) * 100).toFixed(1)}% completed every step`
              : "Run the funnel to measure conversion and drop-off."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {funnelResult?.breakdowns?.length ? (
            <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,280px)_1fr] md:items-end">
              <div className="space-y-2">
                <Label>Breakdown group</Label>
                <Select onValueChange={setSelectedBreakdownKey} value={selectedBreakdownKey}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overall">All people</SelectItem>
                    {funnelResult.breakdowns.map((group) => (
                      <SelectItem
                        key={group.breakdownValue}
                        value={`group:${group.breakdownValue}`}
                      >
                        {group.breakdownValue || "(empty)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {funnelResult.breakdowns.slice(0, 4).map((group) => (
                  <button
                    className="rounded-lg border px-3 py-2 text-left hover:bg-muted/40"
                    key={group.breakdownValue}
                    onClick={() => setSelectedBreakdownKey(`group:${group.breakdownValue}`)}
                    type="button"
                  >
                    <span className="block truncate text-muted-foreground text-xs">
                      {group.breakdownValue || "(empty)"}
                    </span>
                    <span className="font-medium tabular-nums">
                      {(group.totalConversionRate * 100).toFixed(1)}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {displayedSteps?.length ? (
            displayedSteps.map((step) => (
              <div className="rounded-xl border p-4" key={step.key}>
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm">
                      {step.step}. {step.label}
                    </p>
                    <p className="mt-1 text-muted-foreground text-xs">
                      {step.count.toLocaleString()} people reached this step
                    </p>
                  </div>
                  <span className="font-semibold text-lg tabular-nums">
                    {(step.conversionRate * 100).toFixed(1)}%
                  </span>
                  <Button
                    onClick={() => onDrilldown(step.step - 1, selectedBreakdown?.breakdownValue)}
                    size="sm"
                    variant="outline"
                  >
                    View people
                  </Button>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-[width]"
                    style={{ width: `${Math.max(1, step.conversionRate * 100)}%` }}
                  />
                </div>
                {step.step > 1 ? (
                  <p className="mt-2 text-muted-foreground text-xs">
                    {step.dropoffCount.toLocaleString()} dropped off (
                    {(step.dropoffRate * 100).toFixed(1)}% from the previous step)
                  </p>
                ) : null}
              </div>
            ))
          ) : (
            <div className="flex h-[360px] items-center justify-center rounded-xl border border-dashed bg-muted/20 text-center">
              <div>
                <Filter className="mx-auto text-muted-foreground" />
                <p className="mt-3 text-sm">Your conversion funnel will appear here</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <PeopleDrilldown
        error={peopleError}
        pending={peoplePending}
        result={people}
        title={peopleTitle}
      />
    </main>
  );
}

function RetentionPreview({
  onDrilldown,
  people,
  peopleError,
  peoplePending,
  peopleTitle,
  result,
}: {
  onDrilldown: (interval: number) => void;
  people?: QueryCustomAnalyticsPersonsResponseType;
  peopleError: unknown;
  peoplePending: boolean;
  peopleTitle: string;
  result?: QueryCustomAnalyticsInsightResponseType;
}) {
  const retentionResult = result?.kind === "retention" ? result : undefined;
  const intervals = retentionResult?.cohorts[0]?.cells.map((cell) => cell.interval) ?? [];
  return (
    <main className="min-w-0 space-y-4 overflow-y-auto p-4 lg:p-6">
      <Card className="min-h-[480px]">
        <CardHeader>
          <CardTitle>Retention cohorts</CardTitle>
          <CardDescription>
            {retentionResult
              ? `${retentionResult.cohorts.length} cohorts grouped by ${retentionResult.period}`
              : "Run retention to see how people return after joining a cohort."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {retentionResult?.cohorts.length ? (
            <div className="overflow-x-auto">
              <div className="min-w-max">
                <div className="mb-2 grid grid-flow-col grid-cols-[140px_90px] auto-cols-[76px] gap-1 text-center text-muted-foreground text-xs">
                  <span className="text-left">Cohort</span>
                  <span>People</span>
                  {intervals.map((interval) => (
                    <span key={interval}>{interval}</span>
                  ))}
                </div>
                <div className="space-y-1">
                  {retentionResult.cohorts.map((cohort) => (
                    <div
                      className="grid grid-flow-col grid-cols-[140px_90px] auto-cols-[76px] gap-1"
                      key={cohort.cohortStart.toISOString()}
                    >
                      <div className="flex items-center text-sm">
                        {cohort.cohortStart.toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                      <div className="flex items-center justify-center rounded-md bg-muted px-2 text-sm tabular-nums">
                        {cohort.cohortSize.toLocaleString()}
                      </div>
                      {cohort.cells.map((cell) => (
                        <button
                          className={`flex h-12 items-center justify-center rounded-md text-xs font-medium tabular-nums ${cell.rate > 0.55 ? "text-white" : "text-foreground"}`}
                          key={cell.interval}
                          onClick={() => onDrilldown(cell.interval)}
                          style={{
                            backgroundColor: `rgba(14, 165, 233, ${Math.max(0.08, cell.rate)})`,
                          }}
                          title={`${cell.count.toLocaleString()} people`}
                          type="button"
                        >
                          {(cell.rate * 100).toFixed(1)}%
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-[360px] items-center justify-center rounded-xl border border-dashed bg-muted/20 text-center">
              <div>
                <Repeat2 className="mx-auto text-muted-foreground" />
                <p className="mt-3 text-sm">Your retention matrix will appear here</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <PeopleDrilldown
        error={peopleError}
        pending={peoplePending}
        result={people}
        title={peopleTitle}
      />
    </main>
  );
}

function PathsPreview({
  onDrilldown,
  people,
  peopleError,
  peoplePending,
  peopleTitle,
  result,
}: {
  onDrilldown: (pathItem: string) => void;
  people?: QueryCustomAnalyticsPersonsResponseType;
  peopleError: unknown;
  peoplePending: boolean;
  peopleTitle: string;
  result?: QueryCustomAnalyticsInsightResponseType;
}) {
  const pathsResult = result?.kind === "paths" ? result : undefined;
  const nodes = new Map<
    string,
    { incoming: number; label: string; outgoing: number; step: number }
  >();
  for (const link of pathsResult?.links ?? []) {
    const sourceKey = `${link.sourceStep}:${link.source}`;
    const source = nodes.get(sourceKey) ?? {
      incoming: 0,
      label: link.source,
      outgoing: 0,
      step: link.sourceStep,
    };
    source.outgoing += link.count;
    nodes.set(sourceKey, source);
    const targetKey = `${link.targetStep}:${link.target}`;
    const target = nodes.get(targetKey) ?? {
      incoming: 0,
      label: link.target,
      outgoing: 0,
      step: link.targetStep,
    };
    target.incoming += link.count;
    nodes.set(targetKey, target);
  }
  const steps = [...new Set([...nodes.values()].map((node) => node.step))].sort(
    (left, right) => left - right,
  );
  const maxCount = Math.max(
    1,
    ...[...nodes.values()].map((node) => Math.max(node.incoming, node.outgoing)),
  );
  const formatSeconds = (seconds: number) =>
    seconds < 60
      ? `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`
      : seconds < 3_600
        ? `${(seconds / 60).toFixed(1)}m`
        : `${(seconds / 3_600).toFixed(1)}h`;

  return (
    <main className="min-w-0 space-y-4 overflow-y-auto p-4 lg:p-6">
      <Card className="min-h-[480px]">
        <CardHeader>
          <CardTitle>User journey paths</CardTitle>
          <CardDescription>
            {pathsResult
              ? `${pathsResult.links.length} common transitions across ${steps.length} visible steps`
              : "Run Paths to discover the routes people take through your app."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pathsResult?.links.length ? (
            <div className="space-y-8">
              <div className="overflow-x-auto pb-2">
                <div className="flex min-w-max items-start gap-5">
                  {steps.map((step, stepIndex) => (
                    <div className="flex items-start gap-5" key={step}>
                      <div className="w-52 space-y-2">
                        <p className="px-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          Step {step}
                        </p>
                        {[...nodes.values()]
                          .filter((node) => node.step === step)
                          .sort(
                            (left, right) =>
                              Math.max(right.incoming, right.outgoing) -
                              Math.max(left.incoming, left.outgoing),
                          )
                          .map((node) => {
                            const count = Math.max(node.incoming, node.outgoing);
                            return (
                              <button
                                className="relative block w-full overflow-hidden rounded-lg border bg-background p-3 text-left hover:border-foreground/30"
                                key={`${node.step}:${node.label}`}
                                onClick={() => onDrilldown(node.label)}
                                type="button"
                              >
                                <div
                                  className="absolute inset-y-0 left-0 bg-emerald-500/10"
                                  style={{ width: `${Math.max(4, (count / maxCount) * 100)}%` }}
                                />
                                <div className="relative flex items-center justify-between gap-3">
                                  <span className="truncate font-medium text-sm" title={node.label}>
                                    {node.label}
                                  </span>
                                  <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                                    {count.toLocaleString()}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                      {stepIndex < steps.length - 1 ? (
                        <GitBranch className="mt-12 text-emerald-500/50" size={18} />
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-3 font-medium text-sm">Top transitions</h3>
                <div className="grid gap-2 xl:grid-cols-2">
                  {pathsResult.links.slice(0, 12).map((link) => (
                    <div
                      className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2"
                      key={`${link.sourceStep}:${link.source}:${link.targetStep}:${link.target}`}
                    >
                      <div className="min-w-0 text-sm">
                        <span className="font-medium">{link.source}</span>
                        <span className="px-2 text-muted-foreground">→</span>
                        <span className="font-medium">{link.target}</span>
                        <p className="mt-0.5 text-muted-foreground text-xs">
                          Average {formatSeconds(link.averageTransitionSeconds)}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {link.count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-[360px] items-center justify-center rounded-xl border border-dashed bg-muted/20 text-center">
              <div>
                <GitBranch className="mx-auto text-muted-foreground" />
                <p className="mt-3 text-sm">Your most common user journeys will appear here</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <PeopleDrilldown
        error={peopleError}
        pending={peoplePending}
        result={people}
        title={peopleTitle}
      />
    </main>
  );
}

function StickinessPreview({
  display,
  onDrilldown,
  people,
  peopleError,
  peoplePending,
  peopleTitle,
  result,
}: {
  display: "bar" | "line";
  onDrilldown: (seriesKey: string) => void;
  people?: QueryCustomAnalyticsPersonsResponseType;
  peopleError: unknown;
  peoplePending: boolean;
  peopleTitle: string;
  result?: QueryCustomAnalyticsInsightResponseType;
}) {
  const stickinessResult = result?.kind === "stickiness" ? result : undefined;
  const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
  const rows = new Map<number, Record<string, number>>();
  for (const series of stickinessResult?.series ?? []) {
    for (const bucket of series.buckets) {
      const row = rows.get(bucket.intervals) ?? { intervals: bucket.intervals };
      row[series.key] = bucket.count;
      rows.set(bucket.intervals, row);
    }
  }
  const data = [...rows.values()].sort((left, right) => left.intervals - right.intervals);
  const config = Object.fromEntries(
    (stickinessResult?.series ?? []).map((series, index) => [
      series.key,
      { color: palette[index % palette.length] ?? "var(--chart-1)", label: series.label },
    ]),
  ) satisfies ChartConfig;

  return (
    <main className="min-w-0 space-y-4 overflow-y-auto p-4 lg:p-6">
      <Card className="min-h-[480px]">
        <CardHeader>
          <CardTitle>Stickiness distribution</CardTitle>
          <CardDescription>
            {stickinessResult
              ? `${stickinessResult.computation === "cumulative" ? "People active in at least" : "People active in exactly"} N ${stickinessResult.interval} intervals`
              : "Run Stickiness to see how frequently people repeat the selected behavior."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.length ? (
            <ChartContainer className="h-[360px] w-full" config={config}>
              {display === "line" ? (
                <LineChart accessibilityLayer data={data} margin={{ left: 8, right: 20 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis axisLine={false} dataKey="intervals" tickLine={false} tickMargin={10} />
                  <YAxis axisLine={false} allowDecimals={false} tickLine={false} width={42} />
                  <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                  {(stickinessResult?.series ?? []).map((series, index) => (
                    <Line
                      dataKey={series.key}
                      dot={false}
                      key={series.key}
                      stroke={palette[index % palette.length] ?? "var(--chart-1)"}
                      strokeWidth={2.5}
                      type="monotone"
                    />
                  ))}
                </LineChart>
              ) : (
                <BarChart accessibilityLayer data={data} margin={{ left: 8, right: 20 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis axisLine={false} dataKey="intervals" tickLine={false} tickMargin={10} />
                  <YAxis axisLine={false} allowDecimals={false} tickLine={false} width={42} />
                  <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                  {(stickinessResult?.series ?? []).map((series, index) => (
                    <Bar
                      dataKey={series.key}
                      fill={palette[index % palette.length] ?? "var(--chart-1)"}
                      key={series.key}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              )}
            </ChartContainer>
          ) : (
            <div className="flex h-[360px] items-center justify-center rounded-xl border border-dashed bg-muted/20 text-center">
              <div>
                <Activity className="mx-auto text-muted-foreground" />
                <p className="mt-3 text-sm">Your frequency distribution will appear here</p>
              </div>
            </div>
          )}
          {stickinessResult ? (
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
              {stickinessResult.series.map((series) => (
                <Button
                  key={series.key}
                  onClick={() => onDrilldown(series.key)}
                  size="sm"
                  variant="outline"
                >
                  View people · {series.label}
                </Button>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <PeopleDrilldown
        error={peopleError}
        pending={peoplePending}
        result={people}
        title={peopleTitle}
      />
    </main>
  );
}

function LifecyclePreview({
  display,
  onDrilldown,
  people,
  peopleError,
  peoplePending,
  peopleTitle,
  result,
  valueMode,
}: {
  display: "line" | "stacked_area";
  onDrilldown: () => void;
  people?: QueryCustomAnalyticsPersonsResponseType;
  peopleError: unknown;
  peoplePending: boolean;
  peopleTitle: string;
  result?: QueryCustomAnalyticsInsightResponseType;
  valueMode: "count" | "percentage";
}) {
  const lifecycleResult = result?.kind === "lifecycle" ? result : undefined;
  const colors = {
    dormant: "var(--chart-5)",
    new: "var(--chart-2)",
    resurrecting: "var(--chart-3)",
    returning: "var(--chart-1)",
  } as const;
  const rows = new Map<string, Record<string, number | string>>();
  for (const series of lifecycleResult?.series ?? []) {
    for (const point of series.points) {
      const date = point.timestamp.toISOString();
      const row = rows.get(date) ?? { date };
      row[series.status] = series.status === "dormant" ? -point.count : point.count;
      rows.set(date, row);
    }
  }
  const data = [...rows.values()]
    .sort((left, right) => String(left.date).localeCompare(String(right.date)))
    .map((row) => {
      if (valueMode === "count") return row;
      const statuses = lifecycleResult?.series.map((series) => series.status) ?? [];
      const total = statuses.reduce((sum, status) => {
        const value = row[status];
        return sum + Math.abs(typeof value === "number" ? value : 0);
      }, 0);
      return Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          key === "date" || typeof value !== "number" || total === 0
            ? value
            : (value / total) * 100,
        ]),
      );
    });
  const config = Object.fromEntries(
    (lifecycleResult?.series ?? []).map((series) => [
      series.status,
      { color: colors[series.status], label: series.status },
    ]),
  ) satisfies ChartConfig;

  return (
    <main className="min-w-0 space-y-4 overflow-y-auto p-4 lg:p-6">
      <Card className="min-h-[480px]">
        <CardHeader>
          <CardTitle>Behavior lifecycle</CardTitle>
          <CardDescription>
            {lifecycleResult
              ? `Audience movement grouped by ${lifecycleResult.granularity}`
              : "Run Lifecycle to separate growth, engagement, resurrection, and dormancy."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.length ? (
            <ChartContainer className="h-[360px] w-full" config={config}>
              {display === "line" ? (
                <LineChart accessibilityLayer data={data} margin={{ left: 8, right: 20 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="date"
                    tickFormatter={(value: string) =>
                      new Date(value).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })
                    }
                    tickLine={false}
                    tickMargin={10}
                  />
                  <YAxis
                    axisLine={false}
                    allowDecimals={valueMode === "percentage"}
                    tickFormatter={(value: number) =>
                      valueMode === "percentage" ? `${value}%` : String(value)
                    }
                    tickLine={false}
                    width={48}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                  {(lifecycleResult?.series ?? []).map((series) => (
                    <Line
                      dataKey={series.status}
                      dot={false}
                      key={series.status}
                      stroke={colors[series.status]}
                      strokeWidth={2.5}
                      type="monotone"
                    />
                  ))}
                </LineChart>
              ) : (
                <AreaChart
                  accessibilityLayer
                  data={data}
                  margin={{ left: 8, right: 20 }}
                  stackOffset="sign"
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="date"
                    tickFormatter={(value: string) =>
                      new Date(value).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })
                    }
                    tickLine={false}
                    tickMargin={10}
                  />
                  <YAxis
                    axisLine={false}
                    allowDecimals={valueMode === "percentage"}
                    tickFormatter={(value: number) =>
                      valueMode === "percentage" ? `${value}%` : String(value)
                    }
                    tickLine={false}
                    width={48}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                  {(lifecycleResult?.series ?? []).map((series) => (
                    <Area
                      dataKey={series.status}
                      fill={colors[series.status]}
                      fillOpacity={0.28}
                      key={series.status}
                      stackId="lifecycle"
                      stroke={colors[series.status]}
                      strokeWidth={2}
                      type="monotone"
                    />
                  ))}
                </AreaChart>
              )}
            </ChartContainer>
          ) : (
            <div className="flex h-[360px] items-center justify-center rounded-xl border border-dashed bg-muted/20 text-center">
              <div>
                <Layers3 className="mx-auto text-muted-foreground" />
                <p className="mt-3 text-sm">Your lifecycle chart will appear here</p>
              </div>
            </div>
          )}
          {lifecycleResult ? (
            <div className="mt-4 border-t pt-4">
              <Button onClick={onDrilldown} size="sm" variant="outline">
                View matching people
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <PeopleDrilldown
        error={peopleError}
        pending={peoplePending}
        result={people}
        title={peopleTitle}
      />
    </main>
  );
}
