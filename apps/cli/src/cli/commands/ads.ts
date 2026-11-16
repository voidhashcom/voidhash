import type {
  AdAccountJsonEncoding,
  AdCampaignJsonEncoding,
  AdDeliveryStatus,
  AdGroupJsonEncoding,
  AdJsonEncoding,
  AdsMeasuredMetrics,
  AdsPerformanceRow,
  AdsReportWarning,
  AvailableAdAccount,
} from "@voidhash/generated-clients";
import { todayIn } from "@voidhash/lib/report-period";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import { Argument, Command, Flag, Prompt } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { apiError, ExitCode, userError } from "../../utils/error-formatter";
import {
  dashboardUrl,
  projectKind,
  readCliConfig,
  resolveProject,
  type ProjectContext,
} from "../context";
import { confirmChange, findItem, isInteractive, requireItem, type ItemKind } from "../input";
import {
  formatFields,
  formatMoney,
  formatTimeAgo,
  outputModeOf,
  printIds,
  printItem,
  printJson,
  printTable,
} from "../output";
import { outputOptions, projectOption, yesOption } from "../shared-options";
import { adsMeasurementCommand } from "./ads-measurement";
import { formatCount, formatRate, formatRoas, periodOf, periodOptions } from "./analytics-period";

// ---------------------------------------------------------------------------
// Naming ad accounts and campaigns
// ---------------------------------------------------------------------------

export const adAccountKind: ItemKind<AdAccountJsonEncoding> = {
  noun: "ad account",
  label: (account) => `${account.name} (act_${account.externalId})`,
  listCommand: "voidhash-cli ads accounts",
  createCommand: "voidhash-cli ads connect",
  keys: (account) => [account.externalId, `act_${account.externalId}`],
  names: (account) => [account.name],
};

const campaignKind: ItemKind<AdCampaignJsonEncoding> = {
  noun: "campaign",
  label: (campaign) => `${campaign.name} (${campaign.id})`,
  listCommand: "voidhash-cli ads campaigns",
  keys: () => [],
  names: (campaign) => [campaign.name],
};

const listAccounts = (projectId: string) =>
  Effect.flatMap(ApiClient, (api) => readAll((query) => api.adAccountsList(projectId, query)));

const listCampaigns = (projectId: string) =>
  Effect.flatMap(ApiClient, (api) => readAll((query) => api.adsListCampaigns(projectId, query)));

/**
 * Today in the time zone ads reports cut days in: `--timezone`, else the one
 * every connected account shares, else UTC.
 */
const adsToday = (projectId: string, timezone: Option.Option<string>) =>
  Effect.gen(function* () {
    const now = yield* DateTime.now;
    if (Option.isSome(timezone)) return todayIn(now, timezone.value);
    const zones = Arr.dedupe((yield* listAccounts(projectId)).map((account) => account.timezone));
    const [only, ...others] = zones;
    return todayIn(now, only !== undefined && Arr.isReadonlyArrayEmpty(others) ? only : "UTC");
  });

const DELIVERY_LABELS: Readonly<Record<AdDeliveryStatus, string>> = {
  delivering: "delivering",
  learning: "learning",
  learning_limited: "learning limited",
  not_delivering: "not delivering",
  in_review: "in review",
  rejected: "rejected",
  paused: "paused",
  off_by_parent: "off (parent off)",
  scheduled: "scheduled",
  ended: "ended",
  account_issue: "account issue",
};

const DELIVERY_STATUSES = R.keys(DELIVERY_LABELS);

const deliveryChoices = DELIVERY_STATUSES.map(
  (status) => [status.replaceAll("_", "-"), status] as const,
);

const reportFlags = {
  currency: Flag.String("currency").pipe(
    Flag.withDescription("ISO 4217 code money is reported in (default: the ad accounts' currency)"),
    Flag.optional,
  ),
  timezone: Flag.String("timezone").pipe(
    Flag.withDescription("IANA time zone days are cut in (default: the ad accounts' time zone)"),
    Flag.optional,
  ),
  environment: Flag.Literals("environment", ["production", "sandbox", "test"]).pipe(
    Flag.withDescription(
      "Purchases revenue is read from: production (default), sandbox (App Store and Google Play sandbox) or test (debug builds' simulated purchases and test modes such as Stripe's)",
    ),
    Flag.optional,
  ),
  json: Flag.Boolean("json").pipe(
    Flag.withDescription("Print the API report as JSON, for scripts"),
    Flag.withDefault(false),
  ),
};

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

const SYNC_LABELS: Readonly<Record<AdAccountJsonEncoding["syncStatus"], string>> = {
  pending: "first sync running",
  ok: "ok",
  error: "failing, retrying",
  stopped: "stopped",
};

/** `voidhash-cli ads accounts` */
const adsAccountsCommand = Command.make(
  "accounts",
  { project: projectOption, ...outputOptions },
  ({ json, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const projectId = (yield* resolveProject(project)).project.id;
      const accounts = yield* listAccounts(projectId);
      if (mode === "json") return yield* printJson(accounts);
      if (mode === "quiet") return yield* printIds(accounts);
      const now = yield* DateTime.now;
      const ago = (time: Option.Option<string>) =>
        Option.match(time, { onNone: () => "-", onSome: (at) => formatTimeAgo(at, now) });
      yield* printTable(
        [
          { header: "NAME", cell: (account) => account.name },
          { header: "ACCOUNT", cell: (account) => `act_${account.externalId}` },
          { header: "CURRENCY", cell: (account) => account.currency },
          { header: "TIME ZONE", cell: (account) => account.timezone },
          { header: "SYNC", cell: (account) => SYNC_LABELS[account.syncStatus] },
          {
            header: "LAST SYNCED",
            cell: (account) => ago(Option.fromNullishOr(account.lastSyncSucceededAt)),
          },
          { header: "ID", cell: (account) => account.id },
        ],
        accounts,
        "No ad accounts connected. Connect a Meta ad account with 'voidhash-cli ads connect'.",
      );
      const failing = accounts.filter(
        (account) => account.syncStatus === "error" || account.syncStatus === "stopped",
      );
      yield* Effect.forEach(
        failing,
        (account) =>
          Console.error(
            `${adAccountKind.label(account)}: ${account.lastSyncError ?? "the last sync failed"}.${account.syncStatus === "stopped" ? ` Connect it again with 'voidhash-cli ads connect ${account.externalId}'.` : ""}`,
          ),
        { concurrency: 1, discard: true },
      );
    }),
).pipe(Command.withDescription("List the connected ad accounts and how their syncs are doing."));

const CONNECT_USAGE = "voidhash-cli ads connect <ad account id> --token-stdin < token.txt";

/** The access token: piped in with `--token-stdin`, else typed at a hidden prompt. */
const readToken = (fromStdin: boolean) =>
  Effect.gen(function* () {
    if (fromStdin) {
      const stdio = yield* Stdio.Stdio;
      const text = yield* stdio.stdin.pipe(Stream.decodeText(), Stream.mkString);
      const token = text.trim();
      if (token === "") {
        return yield* Effect.fail(
          userError("Nothing was piped in as the access token.", {
            hint: `Run it as: ${CONNECT_USAGE}`,
            exitCode: ExitCode.usage,
          }),
        );
      }
      return token;
    }
    if (!(yield* isInteractive)) {
      return yield* Effect.fail(
        userError("Missing the access token.", {
          hint: `There is no terminal to ask in; pipe it in: ${CONNECT_USAGE}`,
          exitCode: ExitCode.usage,
        }),
      );
    }
    const typed = yield* Prompt.run(
      Prompt.Password({
        message: "Meta system user access token (with ads_read)",
        validate: (text) =>
          text.trim() === "" ? Effect.fail("Paste the token.") : Effect.succeed(text.trim()),
      }),
    );
    return Redacted.value(typed).trim();
  });

const availableLabel = (account: AvailableAdAccount) =>
  `${account.name} (act_${account.externalId}, ${account.currency}${account.status === "inactive" ? ", inactive" : account.status === "no_spend" ? ", no spend" : ""})`;

/** `voidhash-cli ads connect [<ad account id>] [--token-stdin] [--backfill-days]` */
const adsConnectCommand = Command.make(
  "connect",
  {
    account: Argument.String("account").pipe(
      Argument.withDescription(
        "The Meta ad account id, with or without act_ (default: choose from the token's accounts)",
      ),
      Argument.optional,
    ),
    project: projectOption,
    tokenStdin: Flag.Boolean("token-stdin").pipe(
      Flag.withDescription("Read the access token from standard input instead of asking for it"),
      Flag.withDefault(false),
    ),
    backfillDays: Flag.Int("backfill-days").pipe(
      Flag.withDescription("Days of history the first sync reads (default: 90, at most 1095)"),
      Flag.optional,
    ),
    ...outputOptions,
  },
  ({ account, backfillDays, json, project, quiet, tokenStdin }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const accessToken = yield* readToken(tokenStdin);
      const externalId = yield* Option.match(account, {
        onSome: (id) => Effect.succeed(id.trim().replace(/^act_/, "")),
        onNone: () =>
          Effect.gen(function* () {
            const available = yield* api.adAccountsQueryAvailable(projectId, {
              platform: "meta",
              accessToken,
            });
            const choices = available.accounts.filter((candidate) => !candidate.isConnected);
            if (!available.token.hasRequiredPermission || Arr.isReadonlyArrayEmpty(choices)) {
              return yield* Effect.fail(
                userError(
                  available.token.hasRequiredPermission
                    ? "Every ad account this token can read is connected already."
                    : "This token does not grant ads_read, so it reads no ad accounts.",
                  {
                    hint: available.token.hasRequiredPermission
                      ? "'voidhash-cli ads accounts' lists them."
                      : "Create a system user token with ads_read in Meta Business Settings.",
                  },
                ),
              );
            }
            if (!(yield* isInteractive)) {
              return yield* Effect.fail(
                userError(
                  [
                    "Which ad account? The token reads:",
                    ...choices.map((candidate) => `  ${availableLabel(candidate)}`),
                  ].join("\n"),
                  { hint: `Run it as: ${CONNECT_USAGE}`, exitCode: ExitCode.usage },
                ),
              );
            }
            const picked = yield* Prompt.run(
              Prompt.Select({
                message: "Which ad account?",
                choices: choices.map((candidate) => ({
                  title: `${availableLabel(candidate)}${candidate.isSuggested ? " (suggested)" : ""}`,
                  value: candidate,
                })),
              }),
            );
            return picked.externalId;
          }),
      });
      const connected = yield* api
        .adAccountsCreate(projectId, {
          platform: "meta",
          externalId,
          accessToken,
          backfillDays: Option.getOrUndefined(backfillDays),
        })
        .pipe(
          Effect.mapError((error) =>
            apiError(error, {
              ad_account_rejected:
                "Check that the token is a system user token with ads_read, and that its user has access to the account.",
            }),
          ),
        );
      yield* printItem(
        mode,
        connected,
        `Connected ${adAccountKind.label(connected)}; its first sync of ${connected.backfillDays} days has started.\nCheck on it with 'voidhash-cli ads accounts'.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Connect a Meta ad account with a system user token, which is asked for (hidden) or piped in, never passed as a flag.",
  ),
);

/** `voidhash-cli ads disconnect <account> [--yes]` */
const adsDisconnectCommand = Command.make(
  "disconnect",
  {
    account: Argument.String("account").pipe(
      Argument.withDescription("The ad account's name, act_ id or id"),
      Argument.optional,
    ),
    project: projectOption,
    yes: yesOption,
    ...outputOptions,
  },
  ({ account, json, project, quiet, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const found = yield* requireItem(
        adAccountKind,
        yield* listAccounts(projectId),
        account,
        "voidhash-cli ads disconnect <account> --yes",
      );
      yield* confirmChange({
        yes,
        message: `Disconnect ${adAccountKind.label(found)} from ${projectKind(context.session).label(context.project)}? Its synced campaigns, ads and spend are deleted; ads reports lose them.`,
      });
      yield* api.adAccountsDelete(projectId, found.id);
      yield* printItem(
        mode,
        found,
        `Disconnected ${adAccountKind.label(found)}. Connect it again with 'voidhash-cli ads connect ${found.externalId}'.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Disconnect an ad account and delete what was synced from it. Asks first; --yes skips that.",
  ),
);

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

/** The tracking parameters an ad's links lack; empty when none, or for app store ads. */
const missingTracking = (ad: AdJsonEncoding) => ad.missingTrackingParameters ?? [];

const budgetOf = (object: { readonly budget: AdCampaignJsonEncoding["budget"] }) =>
  object.budget === null
    ? "-"
    : `${formatMoney(object.budget.amount, object.budget.currency)} ${object.budget.period}`;

const deliveryOf = (object: Pick<AdCampaignJsonEncoding, "deliveryStatus" | "deliveryReasons">) =>
  `${DELIVERY_LABELS[object.deliveryStatus]}${Arr.match(object.deliveryReasons, {
    onEmpty: () => "",
    onNonEmpty: ([first]) => `: ${first.message}`,
  })}`;

/** One campaign with its ad groups and ads, as a tree. */
const campaignTree = (
  context: ProjectContext,
  campaign: AdCampaignJsonEncoding,
  mode: "human" | "json" | "quiet",
) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    const projectId = context.project.id;
    const { web_url } = yield* readCliConfig;
    const dashboard = dashboardUrl(web_url, context, `ads/campaigns/${campaign.id}`);
    const [adGroups, ads] = yield* Effect.all(
      [
        readAll((query) => api.adsListAdGroups(projectId, { ...query, campaignId: campaign.id })),
        readAll((query) => api.adsListAds(projectId, { ...query, campaignId: campaign.id })),
      ],
      { concurrency: 2 },
    );
    if (mode === "json") return yield* printJson({ ...campaign, adGroups, ads });
    if (mode === "quiet") return yield* Console.log(campaign.id);
    const adLine = (ad: AdJsonEncoding) =>
      `      Ad ${ad.name} (${ad.id}): ${deliveryOf(ad)}${Arr.match(missingTracking(ad), {
        onEmpty: () => "",
        onNonEmpty: (missing) => `; links lack ${missing.join(", ")}`,
      })}`;
    const groupLines = (group: AdGroupJsonEncoding) => [
      `    Ad group ${group.name} (${group.id}): ${deliveryOf(group)}${group.budget === null ? "" : `, budget ${budgetOf(group)}`}${group.learning === null ? "" : `, learning ${group.learning.events}/${group.learning.eventsNeeded}`}`,
      ...ads.filter((ad) => ad.adGroupId === group.id).map(adLine),
    ];
    yield* Console.log(
      [
        `${campaign.name} (${campaign.id})`,
        formatFields([
          ["Delivery", deliveryOf(campaign)],
          ["Objective", campaign.objective ?? "-"],
          ["Destination", campaign.destination ?? "-"],
          ["Budget", budgetOf(campaign)],
          ["Manage", campaign.platformUrl],
          ...Arr.fromOption(Option.map(dashboard, (url) => ["Dashboard", url] as const)),
        ]),
        "",
        ...(Arr.isReadonlyArrayEmpty(adGroups)
          ? ["    No ad groups."]
          : adGroups.flatMap(groupLines)),
        ...ads.filter((ad) => ad.adGroupId === null).map(adLine),
      ].join("\n"),
    );
  });

/** `voidhash-cli ads campaigns [<campaign>] [filters]` */
const adsCampaignsCommand = Command.make(
  "campaigns",
  {
    campaign: Argument.String("campaign").pipe(
      Argument.withDescription("A campaign's name or id: show its ad groups and ads"),
      Argument.optional,
    ),
    project: projectOption,
    account: Flag.String("account").pipe(
      Flag.withDescription("Only this ad account's campaigns: its name, act_ id or id"),
      Flag.optional,
    ),
    status: Flag.Literals("status", ["on", "paused", "removed"]).pipe(
      Flag.withDescription("Only campaigns set to this status"),
      Flag.optional,
    ),
    delivery: Flag.ChoiceWithValue("delivery", deliveryChoices).pipe(
      Flag.withDescription("Only campaigns that deliver like this, such as not-delivering"),
      Flag.optional,
    ),
    destination: Flag.ChoiceWithValue("destination", [
      ["website", "website"],
      ["app-store", "app_store"],
      ["web-to-app", "web_to_app"],
      ["mixed", "mixed"],
    ] as const).pipe(Flag.withDescription("Only campaigns sending people here"), Flag.optional),
    search: Flag.String("search").pipe(
      Flag.withDescription("Only campaigns whose name contains this"),
      Flag.optional,
    ),
    ...outputOptions,
  },
  (flags) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf(flags);
      const api = yield* ApiClient;
      const context = yield* resolveProject(flags.project);
      const projectId = context.project.id;
      if (Option.isSome(flags.campaign)) {
        const campaign = yield* findItem(
          campaignKind,
          yield* readAll((query) =>
            api.adsListCampaigns(projectId, {
              ...query,
              search: flags.campaign.pipe(Option.getOrUndefined),
            }),
          ),
          flags.campaign.value,
        );
        return yield* campaignTree(context, campaign, mode);
      }
      const accountId = yield* Option.match(flags.account, {
        onNone: () => Effect.succeedNone,
        onSome: (input) =>
          Effect.map(
            Effect.flatMap(listAccounts(projectId), (accounts) =>
              findItem(adAccountKind, accounts, input),
            ),
            (account) => Option.some(account.id),
          ),
      });
      const campaigns = yield* readAll((query) =>
        api.adsListCampaigns(projectId, {
          ...query,
          adAccountId: Option.getOrUndefined(accountId),
          status: Option.getOrUndefined(flags.status),
          deliveryStatus: Option.getOrUndefined(flags.delivery),
          destination: Option.getOrUndefined(flags.destination),
          search: Option.getOrUndefined(flags.search),
        }),
      );
      if (mode === "json") return yield* printJson(campaigns);
      if (mode === "quiet") return yield* printIds(campaigns);
      yield* printTable(
        [
          { header: "NAME", cell: (campaign) => campaign.name },
          { header: "DELIVERY", cell: (campaign) => DELIVERY_LABELS[campaign.deliveryStatus] },
          { header: "OBJECTIVE", cell: (campaign) => campaign.objective ?? "-" },
          { header: "DESTINATION", cell: (campaign) => campaign.destination ?? "-" },
          { header: "BUDGET", cell: budgetOf },
          { header: "ID", cell: (campaign) => campaign.id },
        ],
        campaigns,
        "No campaigns match. Campaigns appear once a connected ad account has synced; 'voidhash-cli ads accounts' shows the syncs.",
      );
    }),
).pipe(
  Command.withDescription(
    "List the campaigns synced from your ad accounts, or show one campaign's ad groups and ads.",
  ),
);

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

const SORTS = [
  ["spend", "spend"],
  ["name", "name"],
  ["impressions", "impressions"],
  ["link-clicks", "link_clicks"],
  ["ctr", "ctr"],
  ["platform-roas", "platform_roas"],
  ["signups", "signups"],
  ["payers", "payers"],
  ["cost-per-payer", "cost_per_payer"],
  ["net-revenue", "net_revenue"],
  ["roas", "roas"],
] as const;

const measuredNote = (hasMeasuredAccess: boolean) =>
  hasMeasuredAccess
    ? Effect.void
    : Console.error(
        "Signups, payers and revenue are not shown: your access does not include analytics.",
      );

/** A report caveat as people read it. */
const warningText = (warning: AdsReportWarning) => {
  const what = warning.code.replaceAll("_", " ");
  if ("accountName" in warning) {
    return `${warning.accountName}: ${what}${"reason" in warning && warning.reason !== null ? ` (${warning.reason})` : ""}`;
  }
  if ("currencies" in warning) return `${what}: ${warning.currencies.join(", ")}`;
  return what;
};

/** Report caveats, one line each, on standard error. */
const warningLines = (
  warnings: ReadonlyArray<AdsReportWarning>,
  provisionalFrom: Option.Option<string>,
) =>
  Effect.forEach(
    [
      ...warnings.map(warningText),
      ...Arr.fromOption(
        Option.map(
          provisionalFrom,
          (day) => `numbers from ${day} on are provisional and can still grow`,
        ),
      ),
    ],
    (line) => Console.error(`Note: ${line}.`),
    { concurrency: 1, discard: true },
  );

/** A cell of a measured number: "-" without measured access or without the step. */
const measuredCell =
  <Row extends Pick<AdsPerformanceRow, "measured">>(
    pick: (measured: AdsMeasuredMetrics) => Option.Option<number>,
    format: (value: number) => string,
  ) =>
  (row: Row) =>
    Option.fromNullishOr(row.measured).pipe(
      Option.flatMap(pick),
      Option.match({ onNone: () => "-", onSome: format }),
    );

const LEVELS = [
  ["campaign", "campaign"],
  ["ad-group", "ad_group"],
  ["ad", "ad"],
] as const;

/** `voidhash-cli ads report performance` */
const performanceCommand = Command.make(
  "performance",
  {
    project: projectOption,
    ...periodOptions("7d"),
    level: Flag.ChoiceWithValue("level", LEVELS).pipe(
      Flag.withDescription("One row per campaign, ad group or ad (default: campaign)"),
      Flag.withDefault("campaign" as const),
    ),
    campaign: Flag.String("campaign").pipe(
      Flag.withDescription(
        "Only this campaign (its name or id), or the ad groups and ads in it; repeat for each",
      ),
      Flag.atLeast(0),
    ),
    delivery: Flag.ChoiceWithValue("delivery", [
      ["active", "active"],
      ["needs-attention", "needs_attention"],
    ] as const).pipe(
      Flag.withDescription("Only delivering or learning rows, or those that need attention"),
      Flag.optional,
    ),
    sort: Flag.ChoiceWithValue("sort", SORTS).pipe(
      Flag.withDescription("What rows are sorted by (default: spend, highest first)"),
      Flag.withDefault("spend" as const),
    ),
    breakdown: Flag.Literals("breakdown", [
      "placement",
      "surface",
      "country",
      "age",
      "gender",
      "device",
    ]).pipe(Flag.withDescription("Also split each row by this"), Flag.optional),
    limit: Flag.Int("limit").pipe(
      Flag.withDescription("Rows to show (default: 50, at most 200)"),
      Flag.withDefault(50),
    ),
    ...reportFlags,
  },
  (flags) =>
    Effect.gen(function* () {
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(flags.project)).project.id;
      const period = yield* periodOf(flags, {
        today: yield* adsToday(projectId, flags.timezone),
        defaultLast: "7d",
      });
      const campaigns = Arr.isReadonlyArrayEmpty(flags.campaign)
        ? []
        : yield* Effect.flatMap(listCampaigns(projectId), (all) =>
            Effect.forEach(flags.campaign, (input) => findItem(campaignKind, all, input), {
              concurrency: 1,
            }),
          );
      const report = yield* api.adsReportPerformance(projectId, {
        from: period.from,
        to: period.to,
        level: flags.level,
        campaignIds: Arr.isReadonlyArrayEmpty(campaigns)
          ? undefined
          : campaigns.map(({ id }) => id),
        delivery: Option.getOrUndefined(flags.delivery),
        breakdown: Option.getOrUndefined(flags.breakdown),
        sort: {
          field: flags.sort,
          direction: flags.sort === "name" || flags.sort === "cost_per_payer" ? "asc" : "desc",
        },
        limit: flags.limit,
        currency: Option.getOrUndefined(flags.currency),
        timezone: Option.getOrUndefined(flags.timezone),
        environment: Option.getOrUndefined(flags.environment),
      });
      if (flags.json) return yield* printJson(report);
      const money = (amount: number) => formatMoney(amount, report.currency);
      yield* Console.log(
        `Ads by ${report.level.replace("_", " ")}, ${period.label} (${report.from} to ${report.to}, ${report.timezone}):\n`,
      );
      type Row = (typeof report.data)[number];
      const rows: ReadonlyArray<Row & { readonly label: string }> = report.data.flatMap((row) => [
        { ...row, label: row.name },
        ...(row.breakdown ?? []).map((slice) => ({
          ...row,
          label: `  ${slice.value}`,
          reported: slice.reported ?? { ...row.reported, spend: 0, linkClicks: 0, ctr: null },
          measured: slice.measured,
          // The estimate is of the whole row; a slice has none.
          modeled: null,
        })),
      ]);
      yield* printTable(
        [
          { header: "NAME", cell: (row) => row.label },
          { header: "DELIVERY", cell: (row) => DELIVERY_LABELS[row.deliveryStatus] },
          { header: "SPEND", cell: (row) => money(row.reported.spend) },
          { header: "CLICKS", cell: (row) => formatCount(row.reported.linkClicks) },
          { header: "CTR", cell: (row) => formatRate(Option.fromNullishOr(row.reported.ctr)) },
          { header: "SIGNUPS", cell: measuredCell((m) => Option.some(m.signups), formatCount) },
          { header: "PAYERS", cell: measuredCell((m) => Option.some(m.payers), formatCount) },
          { header: "NET REVENUE", cell: measuredCell((m) => Option.some(m.netRevenue), money) },
          {
            header: "ROAS",
            cell: measuredCell(
              (m) => Option.fromNullishOr(m.roas),
              (roas) => formatRoas(Option.some(roas)),
            ),
          },
          {
            header: "EST. ROAS UP TO",
            cell: (row) => formatRoas(Option.fromNullishOr(row.modeled?.roasHigh)),
          },
          {
            header: "RETURNING REVENUE",
            cell: measuredCell((m) => Option.fromNullishOr(m.returningRevenue), money),
          },
          { header: "ID", cell: (row) => row.id },
        ],
        rows,
        "No delivery in this period.",
      );
      const { totals } = report;
      yield* Console.log(
        `\n${formatFields([
          [
            "Total",
            `${money(totals.reported.spend)} spend, ${formatCount(totals.reported.linkClicks)} link clicks${
              totals.measured === null
                ? ""
                : `, ${formatCount(totals.measured.signups)} signups, ${formatCount(totals.measured.payers)} payers, ${money(totals.measured.netRevenue)} net revenue (ROAS ${formatRoas(Option.fromNullishOr(totals.measured.roas))})`
            }`,
          ],
          ...(totals.measured === null ||
          totals.measured.returningRevenue === null ||
          totals.measured.returningRevenue === 0
            ? []
            : ([
                [
                  "Returning",
                  `${money(totals.measured.returningRevenue)} from people reached again after signing up; not in net revenue or ROAS`,
                ],
              ] as const)),
          ...(totals.modeled === null
            ? []
            : ([
                [
                  "Estimate",
                  `up to ${money(totals.modeled.netRevenueHigh)} net revenue (ROAS ${formatRoas(Option.fromNullishOr(totals.modeled.roasHigh))}), visits seen for ${formatRate(Option.some(totals.modeled.visitCoverage))} of web-bound link clicks. Assumes those clicks Voidhash could not see converted like the ones it could, capped by the net revenue of the people who converted in the period with no credited touch; measured revenue is the floor`,
                ],
              ] as const)),
          ...(report.unallocated === null || report.unallocated.spend === 0
            ? []
            : ([
                ["Not by ad", `${money(report.unallocated.spend)} spend no ad accounts for`],
              ] as const)),
        ])}`,
      );
      if (report.pageInfo.hasNextPage) {
        yield* Console.error(
          `Showing the first ${report.data.length} rows; --limit shows more (up to 200).`,
        );
      }
      yield* measuredNote(report.hasMeasuredAccess);
      yield* warningLines(report.warnings, Option.fromNullishOr(report.provisionalFrom));
    }),
).pipe(
  Command.withDescription(
    "What each campaign, ad group or ad spent and got: the platform's clicks next to the signups, payers and revenue Voidhash measured, with an estimate of what clicks it could not see may have earned.",
  ),
);

/** `voidhash-cli ads report creatives` */
const creativesCommand = Command.make(
  "creatives",
  {
    project: projectOption,
    ...periodOptions("30d"),
    format: Flag.Literals("format", ["image", "video", "carousel"]).pipe(
      Flag.withDescription("Only creatives of this format; repeat for each"),
      Flag.atLeast(0),
    ),
    search: Flag.String("search").pipe(
      Flag.withDescription("Only creatives whose name contains this"),
      Flag.optional,
    ),
    limit: Flag.Int("limit").pipe(
      Flag.withDescription("Creatives to show (default: 25, at most 100)"),
      Flag.withDefault(25),
    ),
    ...reportFlags,
  },
  (flags) =>
    Effect.gen(function* () {
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(flags.project)).project.id;
      const period = yield* periodOf(flags, {
        today: yield* adsToday(projectId, flags.timezone),
        defaultLast: "30d",
      });
      const report = yield* api.adsReportCreatives(projectId, {
        from: period.from,
        to: period.to,
        formats: Arr.isReadonlyArrayEmpty(flags.format) ? undefined : flags.format,
        search: Option.getOrUndefined(flags.search),
        limit: flags.limit,
        currency: Option.getOrUndefined(flags.currency),
        timezone: Option.getOrUndefined(flags.timezone),
        environment: Option.getOrUndefined(flags.environment),
      });
      if (flags.json) return yield* printJson(report);
      const money = (amount: number) => formatMoney(amount, report.currency);
      yield* Console.log(
        `Creatives by spend, ${period.label} (${report.from} to ${report.to}, ${report.timezone}):\n`,
      );
      yield* printTable(
        [
          { header: "NAME", cell: (row: (typeof report.data)[number]) => row.name },
          { header: "FORMAT", cell: (row) => row.format },
          { header: "ADS", cell: (row) => formatCount(row.adCount) },
          { header: "SPEND", cell: (row) => money(row.spend) },
          { header: "CTR", cell: (row) => formatRate(Option.fromNullishOr(row.ctr)) },
          { header: "HOOK", cell: (row) => formatRate(Option.fromNullishOr(row.hookRate)) },
          {
            header: "FREQ",
            cell: (row) => (row.frequency === null ? "-" : formatCount(row.frequency)),
          },
          { header: "ROAS", cell: (row) => formatRoas(Option.fromNullishOr(row.roas)) },
          {
            header: "COST/PAYER",
            cell: (row) => (row.costPerPayer === null ? "-" : money(row.costPerPayer)),
          },
          {
            header: "FATIGUE",
            cell: (row) =>
              row.fatigue === null
                ? "-"
                : `CTR ${formatRate(Option.some(row.fatigue.ctrChange))} over ${row.fatigue.days}d, frequency ${formatCount(row.fatigue.frequency)}`,
          },
          { header: "ID", cell: (row) => row.id },
        ],
        report.data,
        "No creative delivered in this period.",
      );
      if (report.pageInfo.hasNextPage) {
        yield* Console.error(
          `Showing the first ${report.data.length}; --limit shows more (up to 100).`,
        );
      }
      yield* measuredNote(report.hasMeasuredAccess);
      yield* warningLines(report.warnings, Option.fromNullishOr(report.provisionalFrom));
    }),
).pipe(
  Command.withDescription(
    "Which creatives spend the most, what they earn, and which show fatigue (CTR falling as frequency rises).",
  ),
);

/** Days since acquisition the cohorts table shows; --json has every day. */
const COHORT_DAYS_SHOWN = [0, 7, 30, 90, 180, 365];
/** The day a group's chance of paying back is judged at. */
const PAYBACK_HORIZON_DAY = 365;

/** `voidhash-cli ads report cohorts` */
const cohortsCommand = Command.make(
  "cohorts",
  {
    project: projectOption,
    ...periodOptions("13w"),
    by: Flag.ChoiceWithValue("by", [
      ["platform", "platform"],
      ["surface", "surface"],
      ["campaign", "campaign"],
      ["ad-group", "ad_group"],
    ] as const).pipe(
      Flag.withDescription("What the curves are (default: platform)"),
      Flag.withDefault("platform" as const),
    ),
    unit: Flag.Literals("unit", ["week", "month"]).pipe(
      Flag.withDescription("Cohort size (default: week)"),
      Flag.withDefault("week" as const),
    ),
    metric: Flag.ChoiceWithValue("metric", [
      ["roas", "roas"],
      ["revenue-per-payer", "revenue_per_payer"],
      ["payers", "payers"],
    ] as const).pipe(
      Flag.withDescription("What the cells show (default: roas)"),
      Flag.withDefault("roas" as const),
    ),
    ...reportFlags,
  },
  (flags) =>
    Effect.gen(function* () {
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(flags.project)).project.id;
      const period = yield* periodOf(flags, {
        today: yield* adsToday(projectId, flags.timezone),
        defaultLast: "13w",
      });
      const report = yield* api.adsReportCohorts(projectId, {
        from: period.from,
        to: period.to,
        groupBy: flags.by,
        unit: flags.unit,
        metric: flags.metric,
        currency: Option.getOrUndefined(flags.currency),
        timezone: Option.getOrUndefined(flags.timezone),
        environment: Option.getOrUndefined(flags.environment),
      });
      if (flags.json) return yield* printJson(report);
      const money = (amount: number) => formatMoney(amount, report.currency);
      const format = (value: Option.Option<number>) =>
        Option.match(value, {
          onNone: () => "-",
          onSome: (some) =>
            report.metric === "roas"
              ? formatRoas(value)
              : report.metric === "revenue_per_payer"
                ? money(some)
                : formatCount(some),
        });
      const days = Arr.dedupe(report.average.values.map(({ day }) => day)).filter((day) =>
        COHORT_DAYS_SHOWN.includes(day),
      );
      type Projected = NonNullable<(typeof report.average.values)[number]["projected"]>;
      const projected = (value: Projected) =>
        `~${formatRoas(Option.some(value.value))}${value.isPartial ? "+" : ""}`;
      yield* Console.log(
        `${report.metric.replaceAll("_", " ")} by day since acquisition, ${report.unit}ly cohorts acquired ${period.label} (${report.from} to ${report.to}):\n`,
      );
      type Cohort = (typeof report.cohorts)[number];
      yield* printTable(
        [
          { header: "COHORT", cell: (cohort: Cohort) => cohort.start },
          { header: "SPEND", cell: (cohort) => money(cohort.spend) },
          { header: "PEOPLE", cell: (cohort) => formatCount(cohort.people) },
          ...days.map((day) => ({
            header: `DAY ${day}`,
            cell: (cohort: Cohort) => {
              const cell = cohort.values.find((value) => value.day === day);
              if (cell === undefined) return "-";
              // A day the cohort has not completed shows what it is expected to reach.
              if (cell.projected !== null) return projected(cell.projected);
              return `${format(Option.fromNullishOr(cell.value))}${cell.isMaturing ? "*" : ""}`;
            },
          })),
        ],
        report.cohorts,
        "No cohorts: nobody was acquired by a connected platform's ads in this period.",
      );
      yield* Arr.match(report.groups, {
        onEmpty: () => Effect.void,
        onNonEmpty: (groups) =>
          Effect.andThen(
            Console.log(`\nBy ${report.groupBy.replace("_", " ")}:`),
            printTable(
              [
                {
                  header: "GROUP",
                  cell: (group: (typeof groups)[number]) => group.name ?? group.key,
                },
                { header: "PEOPLE", cell: (group) => formatCount(group.people) },
                {
                  header: "PAYBACK",
                  cell: (group) =>
                    group.paybackDay === null ? "not yet" : `day ${group.paybackDay}`,
                },
                ...(report.metric === "roas"
                  ? [
                      {
                        header: `DAY ${PAYBACK_HORIZON_DAY}`,
                        cell: (group: (typeof groups)[number]) => {
                          const value = group.values.find(
                            (point) => point.day === PAYBACK_HORIZON_DAY,
                          );
                          if (value === undefined) return "-";
                          if (value.projected === null)
                            return format(Option.fromNullishOr(value.value));
                          return `${projected(value.projected)} (${formatRoas(Option.some(value.projected.low))}-${formatRoas(Option.some(value.projected.high))})`;
                        },
                      },
                      {
                        header: "PAYBACK CHANCE",
                        cell: (group: (typeof groups)[number]) =>
                          formatRate(Option.fromNullishOr(group.paybackProbability)),
                      },
                    ]
                  : []),
              ],
              groups,
              "",
            ),
          ),
      });
      yield* Console.error(
        report.metric === "roas"
          ? "* still maturing: it can still grow.\n~ projected from the project's renewal and trial history, with its 80% range; --json has every day.\n+ partial: some renewals cannot be projected yet, so likely low."
          : "* still maturing: it can still grow.",
      );
      yield* warningLines(report.warnings, Option.fromNullishOr(report.provisionalFrom));
    }),
).pipe(
  Command.withDescription(
    "Payback by acquisition cohort: ROAS, revenue per payer or payers by day since people's first ad touch.",
  ),
);

/** `voidhash-cli ads report …` */
const adsReportCommand = Command.make("report").pipe(
  Command.withDescription("Ads reports: performance, creatives and cohorts."),
  Command.withSubcommands([performanceCommand, creativesCommand, cohortsCommand]),
);

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

const ATTENTION: ReadonlyArray<AdDeliveryStatus> = [
  "rejected",
  "account_issue",
  "not_delivering",
  "learning_limited",
];

/** `voidhash-cli ads issues` */
const adsIssuesCommand = Command.make(
  "issues",
  { project: projectOption, json: reportFlags.json },
  ({ json, project }) =>
    Effect.gen(function* () {
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const accounts = yield* listAccounts(projectId);
      const syncs = accounts.filter((account) => account.syncStatus !== "ok");
      const delivery = yield* Effect.forEach(
        ATTENTION,
        (deliveryStatus) =>
          Effect.all(
            [
              readAll((query) => api.adsListCampaigns(projectId, { ...query, deliveryStatus })),
              readAll((query) => api.adsListAdGroups(projectId, { ...query, deliveryStatus })),
              readAll((query) => api.adsListAds(projectId, { ...query, deliveryStatus })),
            ],
            { concurrency: 3 },
          ).pipe(
            Effect.map(([campaigns, adGroups, ads]) => [
              ...campaigns.map((object) => ({ level: "Campaign", object })),
              ...adGroups.map((object) => ({ level: "Ad group", object })),
              ...ads.map((object) => ({ level: "Ad", object })),
            ]),
          ),
        { concurrency: 2 },
      ).pipe(Effect.map(Arr.flatten));
      const untracked = (yield* readAll((query) =>
        api.adsListAds(projectId, { ...query, status: "on" }),
      )).filter((ad) => Arr.isReadonlyArrayNonEmpty(missingTracking(ad)));
      if (json) {
        return yield* printJson({
          accounts: syncs,
          delivery: delivery.map(({ object }) => object),
          missingTracking: untracked,
        });
      }
      const lines = [
        ...syncs.map(
          (account) =>
            `${adAccountKind.label(account)}: sync ${SYNC_LABELS[account.syncStatus]}${account.lastSyncError === null ? "" : ` (${account.lastSyncError})`}${account.syncStatus === "stopped" ? `. Connect it again: 'voidhash-cli ads connect ${account.externalId}'` : ""}`,
        ),
        ...delivery.map(
          ({ level, object }) => `${level} ${object.name} (${object.id}): ${deliveryOf(object)}`,
        ),
        ...untracked.map(
          (ad) =>
            `Ad ${ad.name} (${ad.id}): links lack ${missingTracking(ad).join(", ")}, so Voidhash cannot tie the people it brings to it`,
        ),
      ];
      yield* Arr.match(lines, {
        onEmpty: () =>
          Console.log(
            Arr.isReadonlyArrayEmpty(accounts)
              ? "No ad accounts connected. Connect one with 'voidhash-cli ads connect'."
              : "Nothing needs attention: syncs are fine, nothing is rejected or held, and active ads carry the tracking parameters.",
          ),
        onNonEmpty: (some) =>
          Console.log(
            `${some.length} thing${some.length === 1 ? "" : "s"} need${some.length === 1 ? "s" : ""} attention:\n${some.map((line) => `  ${line}`).join("\n")}`,
          ),
      });
    }),
).pipe(
  Command.withDescription(
    "What needs attention: failing syncs, rejected or held campaigns and ads, and active ads missing tracking parameters.",
  ),
);

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** `voidhash-cli ads settings view` */
const settingsViewCommand = Command.make(
  "view",
  { project: projectOption, json: reportFlags.json },
  ({ json, project }) =>
    Effect.gen(function* () {
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const settings = yield* api.adsGetSettings(projectId);
      if (json) return yield* printJson(settings);
      yield* Console.log(
        formatFields([
          [
            "Web-to-app landing pages",
            Arr.match(settings.webToAppLandingPrefixes, {
              onEmpty: () => "none",
              onNonEmpty: (some) => some.join("\n"),
            }),
          ],
        ]),
      );
      yield* Console.error(
        "Website ads landing under these count as web-to-app. Change them with 'voidhash-cli ads settings web-to-app <prefix>…'.",
      );
    }),
).pipe(Command.withDescription("Show the landing pages that mark website ads as web-to-app."));

/** `voidhash-cli ads settings web-to-app <prefix…> | --clear` */
const settingsWebToAppCommand = Command.make(
  "web-to-app",
  {
    prefixes: Argument.String("prefix").pipe(
      Argument.withDescription(
        "Landing page prefixes, such as example.app/start; replaces the list",
      ),
      Argument.variadic(),
    ),
    clear: Flag.Boolean("clear").pipe(
      Flag.withDescription("Remove every prefix"),
      Flag.withDefault(false),
    ),
    project: projectOption,
    json: reportFlags.json,
  },
  ({ clear, json, prefixes, project }) =>
    Effect.gen(function* () {
      if (Arr.isReadonlyArrayEmpty(prefixes) === !clear) {
        return yield* Effect.fail(
          userError(clear ? "--clear takes no prefixes." : "Missing the prefixes.", {
            hint: "Run it as: voidhash-cli ads settings web-to-app example.app/start [more…], or --clear.",
            exitCode: ExitCode.usage,
          }),
        );
      }
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const settings = yield* api
        .adsUpdateSettings(projectId, { webToAppLandingPrefixes: prefixes })
        .pipe(
          Effect.mapError((error) =>
            apiError(error, {
              invalid_landing_prefix:
                "Pass a host with an optional path, such as example.app/start.",
            }),
          ),
        );
      if (json) return yield* printJson(settings);
      yield* Console.log(
        Arr.match(settings.webToAppLandingPrefixes, {
          onEmpty: () => "No landing pages mark ads as web-to-app now.",
          onNonEmpty: (some) =>
            `Website ads landing under ${some.join(", ")} now count as web-to-app; synced ads changed right away.`,
        }),
      );
    }),
).pipe(
  Command.withDescription(
    "Set exactly which landing pages mark website ads as web-to-app (sending people on to your app).",
  ),
);

const adsSettingsCommand = Command.make("settings").pipe(
  Command.withDescription("The project's ads settings."),
  Command.withSubcommands([settingsViewCommand, settingsWebToAppCommand]),
);

/** `voidhash-cli ads …` */
export const adsCommand = Command.make("ads").pipe(
  Command.withAlias("ad"),
  Command.withDescription(
    "Paid acquisition: connect ad accounts, see campaigns and reports, and find what needs attention. Voidhash reads ads; it never changes them.",
  ),
  Command.withSubcommands([
    adsAccountsCommand,
    adsConnectCommand,
    adsDisconnectCommand,
    adsCampaignsCommand,
    adsReportCommand,
    adsIssuesCommand,
    adsSettingsCommand,
    adsMeasurementCommand,
  ]),
);
