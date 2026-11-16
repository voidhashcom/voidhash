import type {
  PaymentProviderJsonEncoding,
  ProductJsonEncoding,
  TrackingHealthResultJsonEncoding,
  WebhookJsonEncoding,
} from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { Command } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { apiError, isApiFailure } from "../../utils/error-formatter";
import { printable } from "../../utils/printable";
import {
  dashboardUrl,
  describeSource,
  projectKind,
  readCliConfig,
  resolveProject,
} from "../context";
import { formatFields, formatTimeAgo, printJson, terminalStyle } from "../output";
import { outputOptions, projectOption } from "../shared-options";
import { listStoreProducts, storeLabel, type StoreProduct } from "./catalog";

/** How one part of the project's setup stands. */
type CheckState = "ok" | "attention" | "problem" | "unknown";

/** One line of the health report, with the command that fixes it. */
export interface HealthCheck {
  readonly name: string;
  readonly state: CheckState;
  readonly summary: string;
  readonly next?: string;
}

/** The check `name` could not be made: why, in a line. */
const unknown = (name: string, error: unknown): HealthCheck => ({
  name,
  state: "unknown",
  summary: `could not check: ${
    isApiFailure(error) ? (apiError(error).message.split("\n")[0] ?? "") : "the API did not answer"
  }`,
});

/** Whether a store is connected to take purchases. */
export const storesCheck = (providers: ReadonlyArray<PaymentProviderJsonEncoding>): HealthCheck => {
  const enabled = providers.filter(({ isEnabled }) => isEnabled);
  const off = providers.filter(({ isEnabled }) => !isEnabled);
  if (Arr.isReadonlyArrayEmpty(enabled)) {
    return {
      name: "Stores",
      state: "problem",
      summary: Arr.isReadonlyArrayEmpty(off)
        ? "none connected"
        : `${off.map(storeLabel).join(", ")} turned off`,
      next: "Connect a store: 'voidhash-cli provider connect app-store' (or google-play, stripe)",
    };
  }
  return {
    name: "Stores",
    state: Arr.isReadonlyArrayEmpty(off) ? "ok" : "attention",
    summary: [
      `${enabled.map(storeLabel).join(", ")} connected`,
      ...(Arr.isReadonlyArrayEmpty(off) ? [] : [`${off.map(storeLabel).join(", ")} turned off`]),
    ].join("; "),
    ...(Arr.isReadonlyArrayEmpty(off) ? {} : { next: "voidhash-cli provider list" }),
  };
};

/** Whether there are products, each sold as a store product. */
export const productsCheck = (
  products: ReadonlyArray<ProductJsonEncoding>,
  storeProducts: ReadonlyArray<StoreProduct>,
): HealthCheck => {
  if (Arr.isReadonlyArrayEmpty(products)) {
    return {
      name: "Products",
      state: "problem",
      summary: "none yet",
      next: "voidhash-cli product create",
    };
  }
  const unmapped = products.filter(
    (product) =>
      !storeProducts.some(({ mapping }) => mapping.productId === product.id && mapping.isActive),
  );
  return Arr.match(unmapped, {
    onEmpty: (): HealthCheck => ({
      name: "Products",
      state: "ok",
      summary: `${products.length}, each mapped to a store product`,
    }),
    onNonEmpty: (missing): HealthCheck => ({
      name: "Products",
      state: "attention",
      summary: `${missing.length} of ${products.length} not mapped to a store product: ${missing.map(({ slug }) => slug).join(", ")}`,
      next: `Map ${missing.length === 1 ? "it" : "them"} to store products: 'voidhash-cli provider products --unmapped', then 'voidhash-cli provider map <store-product> ${missing[0].slug}'`,
    }),
  });
};

/** Whether store purchases wait for a product to be mapped to their store product. */
export const waitingPurchasesCheck = (
  waiting: ReadonlyArray<{ readonly providerProductKey: string; readonly eventCount: number }>,
): HealthCheck =>
  Arr.match(waiting, {
    onEmpty: (): HealthCheck => ({
      name: "Purchases",
      state: "ok",
      summary: "none waiting for a product",
    }),
    onNonEmpty: (some): HealthCheck => ({
      name: "Purchases",
      state: "attention",
      summary: `waiting on ${some.length} unmapped store product${some.length === 1 ? "" : "s"}: ${some
        .slice(0, 3)
        .map(
          ({ eventCount, providerProductKey }) =>
            `${providerProductKey} (${eventCount} event${eventCount === 1 ? "" : "s"})`,
        )
        .join(", ")}${some.length > 3 ? ", …" : ""}`,
      next: "Map them to products: 'voidhash-cli provider products --unmapped' lists them, 'voidhash-cli provider map <store-product> <product>' maps one",
    }),
  });

/** Whether the SDKs reported events in the last seven days, and when each last did. */
export const sdkCheck = (
  health: TrackingHealthResultJsonEncoding,
  now: DateTime.DateTime,
): HealthCheck => {
  const platforms = [
    ...health.apps.map((app) => ({
      name: app.platform === "ios" ? "iOS" : "Android",
      lastEventAt: app.lastEventAt,
      sdk: Arr.head(app.sdkVersions),
    })),
    ...(health.web.lastEventAt === null
      ? []
      : [
          {
            name: "web",
            lastEventAt: health.web.lastEventAt,
            sdk: Arr.head(health.web.sdkVersions),
          },
        ]),
  ];
  return Arr.match(platforms, {
    onEmpty: (): HealthCheck => ({
      name: "SDK events",
      state: "problem",
      summary: "none in the last 7 days",
      next: "Set up the SDK in your app ('voidhash-cli init' in its root), then open the app",
    }),
    onNonEmpty: (seen): HealthCheck => ({
      name: "SDK events",
      state: "ok",
      summary: seen
        .map(
          ({ lastEventAt, name, sdk }) =>
            `${name} ${formatTimeAgo(lastEventAt, now)}${Option.match(sdk, {
              onNone: () => "",
              onSome: ({ version }) => (version === null ? "" : ` (SDK ${version})`),
            })}`,
        )
        .join(", "),
    }),
  });
};

/** Whether the webhooks deliver. */
export const webhooksCheck = (webhooks: ReadonlyArray<WebhookJsonEncoding>): HealthCheck => {
  const failing = webhooks.filter(
    ({ consecutiveFailures, status }) => status === "failed" || consecutiveFailures > 0,
  );
  const active = webhooks.filter(({ status }) => status === "active");
  if (Arr.isReadonlyArrayNonEmpty(failing)) {
    return {
      name: "Webhooks",
      state: "problem",
      summary: failing
        .map(
          ({ consecutiveFailures, name }) =>
            `${name} failing (${consecutiveFailures} deliveries in a row)`,
        )
        .join(", "),
      next: "See how it answered with 'voidhash-cli webhook deliveries --failed'; once it is fixed, 'voidhash-cli webhook retry' sends what gave up",
    };
  }
  return {
    name: "Webhooks",
    state: "ok",
    summary: Arr.isReadonlyArrayEmpty(webhooks)
      ? "none set up"
      : `${active.length} delivering${webhooks.length > active.length ? `, ${webhooks.length - active.length} turned off` : ""}`,
  };
};

/** The command to run first: the fix of the first problem, else of the first thing needing attention. */
export const nextStep = (checks: ReadonlyArray<HealthCheck>) =>
  Arr.findFirst(checks, ({ next, state }) => state === "problem" && next !== undefined).pipe(
    Option.orElse(() =>
      Arr.findFirst(checks, ({ next, state }) => state === "attention" && next !== undefined),
    ),
    Option.flatMap(({ next }) => Option.fromNullishOr(next)),
  );

/** `voidhash-cli status [--json]` */
export const statusCommand = Command.make(
  "status",
  { project: projectOption, json: outputOptions.json },
  ({ json, project }) =>
    Effect.gen(function* () {
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;

      // Every check is independent: one the credential cannot make reads "could not check".
      const [catalog, products, waiting, health, webhooks] = yield* Effect.all(
        [
          Effect.result(listStoreProducts(projectId)),
          Effect.result(readAll((query) => api.productsList(projectId, query))),
          Effect.result(
            readAll((query) => api.paymentProvidersList(projectId, query)).pipe(
              Effect.flatMap((providers) =>
                Effect.forEach(
                  providers,
                  (provider) =>
                    api
                      .paymentProvidersListUnmappedProducts(projectId, provider.id, { limit: 50 })
                      .pipe(Effect.map(({ data }) => data)),
                  { concurrency: 4 },
                ),
              ),
              Effect.map((perProvider) => perProvider.flat()),
            ),
          ),
          Effect.result(api.analyticsReportTrackingHealth(projectId)),
          Effect.result(readAll((query) => api.webhooksList(projectId, query))),
        ],
        { concurrency: 5 },
      );
      const now = yield* DateTime.now;
      const checks: ReadonlyArray<HealthCheck> = [
        Result.match(catalog, {
          onSuccess: ({ providers }) => storesCheck(providers),
          onFailure: (error) => unknown("Stores", error),
        }),
        Result.isFailure(products)
          ? unknown("Products", products.failure)
          : Result.isFailure(catalog)
            ? unknown("Products", catalog.failure)
            : productsCheck(products.success, catalog.success.storeProducts),
        Result.match(waiting, {
          onSuccess: waitingPurchasesCheck,
          onFailure: (error) => unknown("Purchases", error),
        }),
        Result.match(health, {
          onSuccess: (result) => sdkCheck(result, now),
          onFailure: (error) => unknown("SDK events", error),
        }),
        Result.match(webhooks, {
          onSuccess: webhooksCheck,
          onFailure: (error) => unknown("Webhooks", error),
        }),
      ];
      const next = nextStep(checks);
      const { web_url } = yield* readCliConfig;
      const dashboard = dashboardUrl(web_url, context);
      const { person } = context.session;

      if (json) {
        return yield* printJson({
          project: context.project,
          organization: Option.getOrNull(context.organization),
          source: context.source,
          person,
          isReadOnly: context.session.isReadOnly,
          dashboardUrl: Option.getOrNull(dashboard),
          checks,
          next: Option.getOrNull(next),
        });
      }
      const style = yield* terminalStyle;
      const marks: Readonly<Record<CheckState, string>> = {
        ok: style.green("✓"),
        attention: style.yellow("!"),
        problem: style.red("✗"),
        unknown: style.dim("?"),
      };
      const width = Math.max(...checks.map(({ name }) => name.length));
      yield* Console.log(
        [
          style.bold(printable(projectKind(context.session).label(context.project))),
          formatFields([
            ["Project", `${context.project.id}, ${describeSource(context.source)}`],
            [
              "Signed in",
              `${person === null ? "a project secret key" : `${person.name} <${person.email}>`}${context.session.isReadOnly ? " (read-only)" : ""}`,
            ],
            ...Arr.fromOption(Option.map(dashboard, (url) => ["Dashboard", url] as const)),
          ]),
          "",
          ...checks.flatMap(({ name, next: fix, state, summary }) => [
            `  ${marks[state]} ${name.padEnd(width)}  ${summary}`,
            ...(fix === undefined || state === "ok" ? [] : [`    ${" ".repeat(width)}  → ${fix}`]),
          ]),
          "",
          Option.match(next, {
            onNone: () => "Everything is set up.",
            onSome: (step) => `Next: ${step}`,
          }),
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Show the project commands act on here, and its health: stores, products mapped to store products, SDK events, webhooks, and what to do next.",
  ),
);
