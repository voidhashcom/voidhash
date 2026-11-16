import type {
  PaymentProviderHistoryImport,
  PaymentProviderJsonEncoding,
  PaymentProviderProductMappingJsonEncoding,
  ProductJsonEncoding,
} from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { Argument, Command, Flag, Prompt } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import {
  type ApiFailure,
  apiError,
  ExitCode,
  userError,
  userErrorLine,
} from "../../utils/error-formatter";
import { dashboardUrl, projectKind, readCliConfig, resolveProject } from "../context";
import {
  chooseItem,
  confirmChange,
  findItem,
  isInteractive,
  missingInput,
  requireItem,
} from "../input";
import { formatFields, outputModeOf, printIds, printItem, printJson, printTable } from "../output";
import { outputOptions, projectOption, yesOption } from "../shared-options";
import { productKind } from "./catalog";
import { providerConnectCommand } from "./provider-connect";
import {
  providerCancelSubscriptionCommand,
  providerRecordPaymentCommand,
  providerRefundCommand,
} from "./provider-payments";
import {
  catalogProblem,
  describeImport,
  endpointUrlOf,
  isImportable,
  mappingConfigurationFor,
  newSigningSecret,
  notificationTarget,
  providerHandle,
  providerKind,
  providerLabel,
  readCatalog,
  readWaiting,
  STORED_SECRET,
} from "./providers";

const providerArgument = Argument.String("provider").pipe(
  Argument.withDescription(
    "The provider: app-store, google-play, stripe, a payment source's slug or name, or its id",
  ),
  Argument.optional,
);

const providerFlag = Flag.String("provider").pipe(
  Flag.withDescription(
    "The provider selling it (app-store, google-play, stripe, a payment source's slug); needed only when several do",
  ),
  Flag.optional,
);

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

const loadProviders = (projectId: string) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    return yield* readAll((query) => api.paymentProvidersList(projectId, query));
  });

/** The store products a provider sells, as a sentence: "2, 1 not mapped". */
const storeProductCount = (
  catalog: Option.Option<ReadonlyArray<{ readonly mappings: ReadonlyArray<unknown> }>>,
) =>
  Option.match(catalog, {
    onNone: () => "could not be read",
    onSome: (entries) => {
      const unmapped = entries.filter(({ mappings }) => Arr.isReadonlyArrayEmpty(mappings)).length;
      return `${entries.length}${unmapped === 0 ? "" : `, ${unmapped} not mapped`}`;
    },
  });

/** `voidhash-cli provider list` */
const providerListCommand = Command.make(
  "list",
  { project: projectOption, ...outputOptions },
  ({ json, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const projectId = (yield* resolveProject(project)).project.id;
      const providers = yield* loadProviders(projectId);
      if (mode === "json") return yield* printJson(providers);
      if (mode === "quiet") return yield* printIds(providers);

      // Only people see each provider's health, so only they wait for it.
      const rows = yield* Effect.forEach(
        providers,
        (provider) =>
          Effect.all([readCatalog(projectId, provider), readWaiting(projectId, provider)], {
            concurrency: 2,
          }).pipe(Effect.map(([catalog, waiting]) => ({ provider, catalog, waiting }))),
        { concurrency: 4 },
      );
      yield* printTable(
        [
          { header: "NAME", cell: ({ provider }) => providerLabel(provider) },
          { header: "STATUS", cell: ({ provider }) => (provider.isEnabled ? "enabled" : "off") },
          {
            header: "STORE PRODUCTS",
            cell: ({ catalog }) => storeProductCount(catalog),
          },
          {
            header: "WAITING",
            cell: ({ waiting }) => {
              const events = waiting.reduce((sum, { eventCount }) => sum + eventCount, 0);
              return events === 0 ? "-" : plural(events, "purchase event");
            },
          },
          { header: "ID", cell: ({ provider }) => provider.id },
        ],
        rows,
        "No payment providers yet. Connect one with 'voidhash-cli provider connect app-store' (or google-play, stripe, payment-source).",
      );
      yield* Effect.forEach(
        rows.filter(({ catalog }) => Option.isNone(catalog)),
        ({ provider }) => Console.error(catalogProblem(provider)),
        { concurrency: 1, discard: true },
      );
      if (rows.some(({ waiting }) => Arr.isReadonlyArrayNonEmpty(waiting))) {
        yield* Console.error(
          "Imported purchases wait for store products to be mapped: 'voidhash-cli provider products --unmapped' lists them.",
        );
      }
    }),
).pipe(
  Command.withDescription(
    "List where the project takes payments, with each provider's health: enabled, store products read and mapped, purchases waiting for a mapping.",
  ),
);

/** `voidhash-cli provider view <provider>` */
const providerViewCommand = Command.make(
  "view",
  { provider: providerArgument, project: projectOption, ...outputOptions },
  ({ json, project, provider, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const found = yield* requireItem(
        providerKind,
        yield* loadProviders(projectId),
        provider,
        "voidhash-cli provider view <provider>",
      );
      if (mode === "quiet") return yield* printIds([found]);
      const [catalog, waiting, imports] = yield* Effect.all(
        [
          readCatalog(projectId, found),
          readWaiting(projectId, found),
          isImportable(found)
            ? readAll((query) => api.paymentProviderHistoryImportsList(projectId, found.id, query))
            : Effect.succeed([]),
        ],
        { concurrency: 3 },
      );
      if (mode === "json") {
        return yield* printJson({
          ...found,
          storeProducts: Option.getOrNull(catalog),
          waitingForMapping: waiting,
          imports,
        });
      }
      const { api_url, web_url } = yield* readCliConfig;
      const handle = providerHandle(found);
      const target = notificationTarget(api_url, found);
      yield* Console.log(
        [
          providerLabel(found),
          formatFields([
            [
              "Status",
              found.isEnabled
                ? "enabled"
                : found.type === "payment_source"
                  ? `off: the purchases it reports are refused ('voidhash-cli provider edit ${handle} --enable')`
                  : `off: it processes no purchases until its credentials are saved ('voidhash-cli provider connect ${handle}')`,
            ],
            [
              "Store products",
              Option.match(catalog, {
                onNone: () => catalogProblem(found),
                onSome: (entries) =>
                  entries.some(({ mappings }) => Arr.isReadonlyArrayEmpty(mappings))
                    ? `${storeProductCount(catalog)} ('voidhash-cli provider products ${handle} --unmapped')`
                    : storeProductCount(catalog),
              }),
            ],
            ...(Arr.isReadonlyArrayEmpty(waiting)
              ? []
              : [
                  [
                    "Waiting",
                    waiting
                      .map(
                        ({ eventCount, providerProductKey }) =>
                          `${providerProductKey}: ${plural(eventCount, "purchase event")}`,
                      )
                      .join("\n"),
                  ] as const,
                ]),
            ...(found.type === "payment_source"
              ? [
                  [
                    "Endpoint",
                    Option.getOrElse(
                      endpointUrlOf(found, "endpoint"),
                      () => `none ('voidhash-cli provider edit ${handle} --endpoint <url>')`,
                    ),
                  ] as const,
                  ...Arr.fromOption(
                    Option.map(
                      endpointUrlOf(found, "testEndpoint"),
                      (url) => ["Test endpoint", url] as const,
                    ),
                  ),
                ]
              : []),
            ...(isImportable(found)
              ? [
                  [
                    "History",
                    Arr.match(imports, {
                      onEmpty: () => `never imported ('voidhash-cli provider import ${handle}')`,
                      onNonEmpty: (latest) =>
                        latest
                          .map((entry) => `${entry.environment}: ${describeImport(entry)}`)
                          .join("\n"),
                    }),
                  ] as const,
                ]
              : []),
            ...Arr.fromOption(
              Option.map(
                target,
                ({ url, where }) => ["Notifications", `${url}\nset it as ${where}`] as const,
              ),
            ),
            ["ID", found.id],
            ...Arr.fromOption(
              Option.map(
                dashboardUrl(web_url, context, `settings/payment-providers/${found.id}`),
                (url) => ["Dashboard", url] as const,
              ),
            ),
          ]),
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Show a payment provider: its status, store products, purchases waiting for a mapping, history imports and the address its store sends notifications to.",
  ),
);

/** `voidhash-cli provider test <provider>` */
const providerTestCommand = Command.make(
  "test",
  { provider: providerArgument, project: projectOption, ...outputOptions },
  ({ json, project, provider, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const found = yield* requireItem(
        providerKind,
        yield* loadProviders(projectId),
        provider,
        "voidhash-cli provider test <provider>",
      );
      const handle = providerHandle(found);
      const report = (
        result: "works" | "fails",
        detail: string,
        operations: Option.Option<ReadonlyArray<string>> = Option.none(),
      ) =>
        Effect.gen(function* () {
          if (mode === "json") {
            yield* printJson({
              paymentProviderId: found.id,
              result,
              detail,
              operations: Option.getOrNull(operations),
            });
          } else if (mode === "quiet") {
            yield* Console.log(result);
          } else {
            yield* Console.log(`${providerLabel(found)}: ${detail}`);
          }
          if (result === "fails")
            return yield* Effect.fail(
              userError(`${providerLabel(found)} does not work.`, {
                hint: `Save new credentials with 'voidhash-cli provider connect ${handle}'.`,
              }),
            );
        });

      if (found.type === "payment_source") {
        // Each endpoint is tested as the requests it serves: the main one with
        // production requests, the test one with test requests.
        const configured = [
          ...Arr.fromOption(
            Option.map(endpointUrlOf(found, "endpoint"), (url) => ({
              environment: "production" as const,
              name: "endpoint",
              url,
              rotateFlag: "--rotate-secret",
            })),
          ),
          ...Arr.fromOption(
            Option.map(endpointUrlOf(found, "testEndpoint"), (url) => ({
              environment: "test" as const,
              name: "test endpoint",
              url,
              rotateFlag: "--rotate-test-secret",
            })),
          ),
        ];
        if (Arr.isReadonlyArrayEmpty(configured)) {
          return yield* Effect.fail(
            userError(`${providerLabel(found)} has no endpoint to test.`, {
              hint: `Connect one first: 'voidhash-cli provider edit ${handle} --endpoint <url>' (or --test-endpoint <url> for test requests only).`,
            }),
          );
        }
        const results = yield* Effect.forEach(
          configured,
          (target) =>
            Effect.map(
              Effect.result(
                api.paymentProvidersTest(projectId, found.id, {
                  environment: target.environment,
                }),
              ),
              (tested) =>
                Result.match(tested, {
                  onSuccess: (description) => {
                    const missing = [
                      "catalog.list",
                      "history.list",
                      "subscription.cancel",
                      "transaction.refund",
                    ].filter((operation) => !description.operations.includes(operation));
                    return {
                      ...target,
                      result: "works" as const,
                      detail: `answers${description.sdk === null ? "" : ` (${description.sdk.name} ${description.sdk.version})`} and implements ${description.operations.join(", ")}.${Arr.isReadonlyArrayEmpty(missing) ? "" : ` Not implemented: ${missing.join(", ")}.`}`,
                      operations: description.operations,
                    };
                  },
                  // A failing endpoint is reported next to the others, not as the command's error.
                  onFailure: (error) => ({
                    ...target,
                    result: "fails" as const,
                    detail: userErrorLine(
                      apiError(error, {
                        payment_source_endpoint_not_configured: `Connect it first: 'voidhash-cli provider edit ${handle} --${target.environment === "test" ? "test-endpoint" : "endpoint"} <url>'.`,
                        payment_source_endpoint_rejected: `Its server likely has another signing secret: 'voidhash-cli provider edit ${handle} ${target.rotateFlag}' makes a new one to give it.`,
                      }),
                    ),
                    operations: null,
                  }),
                }),
            ),
          { concurrency: 2 },
        );
        const failing = results.filter(({ result }) => result === "fails");
        const overall = Arr.isReadonlyArrayEmpty(failing) ? "works" : "fails";
        const lines = results.map(
          ({ detail, name, result, url }) =>
            `${name} ${url}: ${result === "works" ? "" : "fails: "}${detail}`,
        );
        if (mode === "json") {
          yield* printJson({
            paymentProviderId: found.id,
            result: overall,
            detail: lines.join("\n"),
            endpoints: results.map(({ detail, environment, operations, result, url }) => ({
              environment,
              url,
              result,
              detail,
              operations,
            })),
          });
        } else if (mode === "quiet") {
          yield* Console.log(overall);
        } else {
          yield* Console.log(lines.map((line) => `${providerLabel(found)} ${line}`).join("\n"));
        }
        if (Arr.isReadonlyArrayNonEmpty(failing)) {
          return yield* Effect.fail(
            userError(
              failing.length === 1
                ? `${providerLabel(found)}'s ${Arr.headNonEmpty(failing).name} does not work.`
                : `Neither endpoint of ${providerLabel(found)} works.`,
            ),
          );
        }
        return;
      }
      if (!found.isEnabled) {
        return yield* report("fails", "it is not enabled, so its credentials were never checked.");
      }
      const catalog = yield* readCatalog(projectId, found, { refresh: true });
      return yield* Option.match(catalog, {
        onNone: () => report("fails", catalogProblem(found)),
        onSome: (entries) =>
          report(
            "works",
            `Voidhash read ${plural(entries.length, "store product")} with the saved credentials, so they work.`,
          ),
      });
    }),
).pipe(
  Command.withDescription(
    "Check that Voidhash can reach a provider with what is saved: it reads an App Store, Google Play or Stripe catalog again, or calls each of a payment source's endpoints, the test one with a test request. Exits with 1 when it does not work.",
  ),
);

/** A store product as the products command lists it. */
interface StoreProductRow {
  readonly provider: PaymentProviderJsonEncoding;
  readonly providerProductKey: string;
  readonly name: Option.Option<string>;
  readonly configuration: Record<string, unknown>;
  readonly mappings: ReadonlyArray<PaymentProviderProductMappingJsonEncoding>;
  readonly waitingEvents: number;
}

/** Every store product `providers` sell, with their mappings and the purchases waiting for them. */
const loadStoreProducts = (
  projectId: string,
  providers: ReadonlyArray<PaymentProviderJsonEncoding>,
  options: { readonly isUnmapped?: boolean; readonly refresh?: boolean } = {},
) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    const perProvider = yield* Effect.forEach(
      providers,
      (provider) =>
        Effect.gen(function* () {
          const [catalog, mappings, waiting] = yield* Effect.all(
            [
              readCatalog(projectId, provider, options),
              readAll((query) => api.paymentProviderProductsList(projectId, provider.id, query)),
              readWaiting(projectId, provider),
            ],
            { concurrency: 3 },
          );
          const waitingFor = (key: string) =>
            waiting.find(({ providerProductKey }) => providerProductKey === key)?.eventCount ?? 0;
          const listed = Option.getOrElse(catalog, () => []).map((entry): StoreProductRow => ({
            provider,
            providerProductKey: entry.providerProductKey,
            name: entry.name === entry.providerProductKey ? Option.none() : Option.some(entry.name),
            configuration: entry.configuration,
            mappings: mappings.filter(
              ({ providerProductKey }) => providerProductKey === entry.providerProductKey,
            ),
            waitingEvents: waitingFor(entry.providerProductKey),
          }));
          // Purchases can name store products the catalog does not list, such as archived Stripe prices.
          const seenInPurchases =
            options.isUnmapped === false
              ? []
              : waiting
                  .filter(
                    ({ providerProductKey }) =>
                      !listed.some((row) => row.providerProductKey === providerProductKey),
                  )
                  .map(({ eventCount, providerProductKey }): StoreProductRow => ({
                    provider,
                    providerProductKey,
                    name: Option.none(),
                    configuration: mappingConfigurationFor(provider.type, providerProductKey),
                    mappings: [],
                    waitingEvents: eventCount,
                  }));
          return { provider, catalog, rows: [...listed, ...seenInPurchases] };
        }),
      { concurrency: 4 },
    );
    return {
      rows: perProvider.flatMap(({ rows }) => rows),
      unreadable: perProvider.flatMap(({ provider, catalog }) =>
        Option.isNone(catalog) ? [provider] : [],
      ),
    };
  });

const productCell = (
  mappings: ReadonlyArray<PaymentProviderProductMappingJsonEncoding>,
  products: ReadonlyArray<ProductJsonEncoding>,
) =>
  mappings
    .map((mapping) => {
      const slug = products.find(({ id }) => id === mapping.productId)?.slug ?? mapping.productId;
      const where = mapping.environment === "all" ? "" : ` [${mapping.environment}]`;
      return `${slug}${where}${mapping.isActive ? "" : " (inactive)"}`;
    })
    .join(", ") || "-";

/** `voidhash-cli provider products [provider] [--unmapped | --mapped] [--refresh]` */
const providerProductsCommand = Command.make(
  "products",
  {
    provider: providerArgument,
    unmapped: Flag.Boolean("unmapped").pipe(
      Flag.withDescription("Only store products not mapped to a product yet"),
      Flag.withDefault(false),
    ),
    mapped: Flag.Boolean("mapped").pipe(
      Flag.withDescription("Only store products mapped to a product"),
      Flag.withDefault(false),
    ),
    refresh: Flag.Boolean("refresh").pipe(
      Flag.withDescription("Read the stores again instead of Voidhash's copy, up to an hour old"),
      Flag.withDefault(false),
    ),
    project: projectOption,
    ...outputOptions,
  },
  ({ json, mapped, project, provider, quiet, refresh, unmapped }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      if (mapped && unmapped) {
        return yield* Effect.fail(
          userError("--mapped and --unmapped cannot be combined.", { exitCode: ExitCode.usage }),
        );
      }
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const providers = yield* loadProviders(projectId);
      const selected = yield* Option.match(provider, {
        onNone: () => Effect.succeed(providers),
        onSome: (input) => Effect.map(findItem(providerKind, providers, input), Arr.of),
      });
      const { rows, unreadable } = yield* loadStoreProducts(projectId, selected, {
        refresh,
        ...(unmapped ? { isUnmapped: true } : mapped ? { isUnmapped: false } : {}),
      });
      if (mode === "json") {
        return yield* printJson(
          rows.map((row) => ({
            paymentProviderId: row.provider.id,
            providerProductKey: row.providerProductKey,
            name: Option.getOrNull(row.name),
            configuration: row.configuration,
            mappings: row.mappings,
            waitingEvents: row.waitingEvents,
          })),
        );
      }
      if (mode === "quiet") {
        return yield* Arr.match(rows, {
          onEmpty: () => Effect.void,
          onNonEmpty: (some) => Console.log(some.map((row) => row.providerProductKey).join("\n")),
        });
      }
      const products = yield* readAll((query) => api.productsList(projectId, query));
      yield* printTable(
        [
          { header: "PROVIDER", cell: (row: StoreProductRow) => providerLabel(row.provider) },
          { header: "STORE PRODUCT", cell: (row) => row.providerProductKey },
          { header: "NAME", cell: (row) => Option.getOrElse(row.name, () => "-") },
          { header: "PRODUCT", cell: (row) => productCell(row.mappings, products) },
          {
            header: "WAITING",
            cell: (row) => (row.waitingEvents === 0 ? "-" : plural(row.waitingEvents, "event")),
          },
        ],
        rows,
        unmapped
          ? "Every store product is mapped to a product."
          : "No store products yet. Create them in the store, then run this again with --refresh.",
      );
      yield* Effect.forEach(unreadable, (failing) => Console.error(catalogProblem(failing)), {
        concurrency: 1,
        discard: true,
      });
      if (rows.some((row) => Arr.isReadonlyArrayEmpty(row.mappings))) {
        yield* Console.error(
          "Map one to a product with 'voidhash-cli provider map <store-product> <product>'.",
        );
      }
    }),
).pipe(
  Command.withDescription(
    "List the store products the App Store, Google Play, Stripe or a payment source sells, with the product each is mapped to and the purchases waiting for one.",
  ),
);

const MAP_USAGE =
  "voidhash-cli provider map <store-product> <product> [--provider <provider>] [--environment all|production|test]";

/** How a mapping's environment reads after a store product: "", or " (test purchases)". */
const mappingScope = (environment: PaymentProviderProductMappingJsonEncoding["environment"]) =>
  environment === "all" ? "" : ` (${environment} purchases)`;

/**
 * The provider selling `key`, and its catalog entry: the one named by
 * `--provider`, else the provider whose catalog or waiting purchases name it,
 * else the only provider.
 */
const locateStoreProduct = (
  projectId: string,
  providers: ReadonlyArray<PaymentProviderJsonEncoding>,
  key: string,
  providerInput: Option.Option<string>,
) =>
  Effect.gen(function* () {
    const named = yield* Option.match(providerInput, {
      onNone: () => Effect.succeed(providers),
      onSome: (input) => Effect.map(findItem(providerKind, providers, input), Arr.of),
    });
    const { rows } = yield* loadStoreProducts(projectId, named);
    const matching = rows.filter((row) => row.providerProductKey === key);
    const [only, ...others] = matching;
    if (only !== undefined && Arr.isReadonlyArrayEmpty(others)) return only;
    if (only !== undefined) {
      return yield* Effect.fail(
        userError(
          [
            `Several providers sell "${key}":`,
            ...matching.map((row) => `  ${providerLabel(row.provider)}  ${row.provider.id}`),
          ].join("\n"),
          { hint: "Pass the one you mean with --provider.", exitCode: ExitCode.usage },
        ),
      );
    }
    const [single, ...more] = named;
    if (single !== undefined && Arr.isReadonlyArrayEmpty(more)) {
      // A store product the catalog does not list, such as an archived Stripe price.
      return {
        provider: single,
        providerProductKey: key,
        name: Option.none(),
        configuration: mappingConfigurationFor(single.type, key),
        mappings: [],
        waitingEvents: 0,
      } satisfies StoreProductRow;
    }
    return yield* Effect.fail(
      userError(`No provider lists a store product "${key}".`, {
        hint: "'voidhash-cli provider products' lists them. To map one a catalog does not list, such as an archived Stripe price (prod_…:price_…), pass --provider.",
        exitCode: ExitCode.notFound,
      }),
    );
  });

/** The store product a command's argument names; on a terminal, chosen among the unmapped ones. */
const requireStoreProduct = (
  projectId: string,
  providers: ReadonlyArray<PaymentProviderJsonEncoding>,
  input: Option.Option<string>,
  providerInput: Option.Option<string>,
  usage: string,
) =>
  Option.match(input, {
    onSome: (key) => locateStoreProduct(projectId, providers, key, providerInput),
    onNone: () =>
      Effect.gen(function* () {
        if (!(yield* isInteractive))
          return yield* Effect.fail(missingInput("the store product", usage));
        const { rows } = yield* loadStoreProducts(projectId, providers, { isUnmapped: true });
        if (Arr.isReadonlyArrayEmpty(rows)) {
          return yield* Effect.fail(
            userError("Every store product is mapped to a product.", {
              hint: "Name one to move it: 'voidhash-cli provider products --mapped' lists them.",
              exitCode: ExitCode.notFound,
            }),
          );
        }
        return yield* Prompt.run(
          Prompt.Select({
            message: "Which store product?",
            choices: rows.map((row) => ({
              title: `${providerLabel(row.provider)}: ${row.providerProductKey}${Option.match(row.name, { onNone: () => "", onSome: (name) => ` "${name}"` })}`,
              value: row,
            })),
          }),
        );
      }),
  });

const parseOffer = (text: string) => {
  const [id = "", ...rest] = text.split("=");
  const offerId = rest.join("=");
  return id === "" || offerId === ""
    ? Effect.fail(
        userError(`--offer ${text} is not <id>=<store offer id>.`, {
          hint: "For example --offer win-back=WINBACK50: paywalls name it win-back, the store WINBACK50.",
          exitCode: ExitCode.usage,
        }),
      )
    : Effect.succeed({ id, offerId });
};

/** `voidhash-cli provider map <store-product> <product> [--provider] [--offer id=storeOfferId]… [--environment] [--yes]` */
const providerMapCommand = Command.make(
  "map",
  {
    storeProduct: Argument.String("store-product").pipe(
      Argument.withDescription(
        "The store's id for it, as 'provider products' lists it (a Stripe price is prod_…:price_…)",
      ),
      Argument.optional,
    ),
    product: Argument.String("product").pipe(
      Argument.withDescription("The product buying it grants: its slug, name or id"),
      Argument.optional,
    ),
    provider: providerFlag,
    offer: Flag.String("offer").pipe(
      Flag.withDescription(
        "An offer a paywall can sell on it, as <id>=<store offer id>; repeat for each. Replaces the saved offers",
      ),
      Flag.atLeast(0),
    ),
    environment: Flag.Literals("environment", ["all", "production", "test"]).pipe(
      Flag.withDescription(
        "For a payment source whose test system names products differently: the purchases this store product key names (default all). App Store and Google Play products name every environment, and a Stripe price's mode decides its own",
      ),
      Flag.optional,
    ),
    project: projectOption,
    yes: yesOption,
    ...outputOptions,
  },
  ({ environment, json, offer, product, project, provider, quiet, storeProduct, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const providers = yield* loadProviders(projectId);
      const offers = yield* Effect.forEach(offer, parseOffer, { concurrency: 1 });
      const store = yield* requireStoreProduct(
        projectId,
        providers,
        storeProduct,
        provider,
        MAP_USAGE,
      );
      if (Option.isSome(environment) && store.provider.type !== "payment_source") {
        return yield* Effect.fail(
          userError(`--environment is for payment sources, not ${providerLabel(store.provider)}.`, {
            hint:
              store.provider.type === "stripe"
                ? "Voidhash reads it from the price: a live price names production purchases, a test price test ones."
                : "Its store products keep their ids in the store's sandbox, so one mapping serves every environment.",
            exitCode: ExitCode.usage,
          }),
        );
      }
      const products = yield* readAll((query) => api.productsList(projectId, query));
      const target = yield* requireItem(productKind, products, product, MAP_USAGE);
      const key = store.providerProductKey;
      const where = `${providerLabel(store.provider)} ${key}`;
      const mappings = yield* readAll((query) =>
        api.paymentProviderProductsList(projectId, store.provider.id, {
          ...query,
          providerProductKey: key,
        }),
      );
      const activeSame = mappings.find((row) => row.isActive && row.productId === target.id);
      const activeOther = mappings.find((row) => row.isActive && row.productId !== target.id);
      const inactiveSame = mappings.find((row) => !row.isActive && row.productId === target.id);
      const withOffers = (configuration: Record<string, unknown>) =>
        Arr.isReadonlyArrayEmpty(offers) ? configuration : { ...configuration, offers };
      const done = (mapping: PaymentProviderProductMappingJsonEncoding, message: string) =>
        printItem(mode, mapping, message);

      if (activeSame !== undefined) {
        const newEnvironment = Option.filter(
          environment,
          (value) => value !== activeSame.environment,
        );
        if (Arr.isReadonlyArrayEmpty(offers) && Option.isNone(newEnvironment)) {
          return yield* done(
            activeSame,
            `${where}${mappingScope(activeSame.environment)} is already mapped to ${productKind.label(target)}.`,
          );
        }
        const updated = yield* api.paymentProviderProductsUpdate(
          projectId,
          store.provider.id,
          activeSame.id,
          {
            configuration: withOffers(activeSame.configuration),
            environment: Option.getOrUndefined(newEnvironment),
          },
        );
        return yield* done(
          updated,
          [
            ...(Arr.isReadonlyArrayEmpty(offers)
              ? []
              : [`Saved the offers of ${where}: ${offers.map(({ id }) => id).join(", ")}.`]),
            ...Arr.fromOption(
              Option.map(
                newEnvironment,
                (value) =>
                  `${where} now names ${value === "all" ? "purchases of every environment" : `${value} purchases only`}.`,
              ),
            ),
          ].join("\n"),
        );
      }
      if (activeOther !== undefined) {
        const previous = products.find(({ id }) => id === activeOther.productId);
        const previousLabel =
          previous === undefined ? activeOther.productId : productKind.label(previous);
        yield* confirmChange({
          yes,
          message: `${where} is mapped to ${previousLabel}. Move it to ${productKind.label(target)}? Its purchases and renewals from now on grant ${target.name}'s perks instead.`,
        });
        const moved = yield* api.paymentProviderProductsCreate(projectId, store.provider.id, {
          productId: target.id,
          configuration: withOffers(inactiveSame?.configuration ?? activeOther.configuration),
          // A payment source's key keeps the purchases it named unless told otherwise.
          environment:
            store.provider.type === "payment_source"
              ? Option.getOrElse(environment, () => activeOther.environment)
              : undefined,
          isReassignment: true,
        });
        return yield* done(
          moved,
          `Moved ${where} from ${previousLabel} to ${productKind.label(target)}.`,
        );
      }
      if (inactiveSame !== undefined) {
        const newEnvironment = Option.filter(
          environment,
          (value) => value !== inactiveSame.environment,
        );
        if (Arr.isReadonlyArrayNonEmpty(offers) || Option.isSome(newEnvironment)) {
          yield* api.paymentProviderProductsUpdate(projectId, store.provider.id, inactiveSame.id, {
            configuration: withOffers(inactiveSame.configuration),
            environment: Option.getOrUndefined(newEnvironment),
          });
        }
        const activated = yield* api.paymentProviderProductsActivate(
          projectId,
          store.provider.id,
          inactiveSame.id,
        );
        return yield* done(activated, `Mapped ${where} to ${productKind.label(target)} again.`);
      }
      const created = yield* api
        .paymentProviderProductsCreate(projectId, store.provider.id, {
          productId: target.id,
          configuration: withOffers(store.configuration),
          environment: Option.getOrUndefined(environment),
        })
        .pipe(
          Effect.mapError((error) =>
            apiError(error, {
              invalid_product_mapping:
                "Name the store product as 'voidhash-cli provider products' lists it: a Stripe price is prod_…:price_…, a Google Play base plan productId:basePlanId (offers need one).",
            }),
          ),
        );
      yield* done(
        created,
        `Mapped ${where}${mappingScope(created.environment)} to ${productKind.label(target)}. Buying it now grants ${target.name}'s perks${store.waitingEvents === 0 ? "" : `; the ${plural(store.waitingEvents, "purchase event")} waiting for it are applied in the background`}.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Map a store product to a product, so buying it grants the product's perks. Moving one mapped to another product asks first; --yes skips that. A payment source whose test system names products differently maps each key with --environment production or test.",
  ),
);

/** `voidhash-cli provider unmap <store-product> [--provider] [--product] [--yes]` */
const providerUnmapCommand = Command.make(
  "unmap",
  {
    storeProduct: Argument.String("store-product").pipe(
      Argument.withDescription("The store's id for it, as 'provider products' lists it"),
      Argument.optional,
    ),
    provider: providerFlag,
    product: Flag.String("product").pipe(
      Flag.withDescription("The product to unmap it from, when it has mappings to several"),
      Flag.optional,
    ),
    project: projectOption,
    yes: yesOption,
    ...outputOptions,
  },
  ({ json, product, project, provider, quiet, storeProduct, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const providers = yield* loadProviders(projectId);
      const usage = "voidhash-cli provider unmap <store-product> [--provider <provider>]";
      const store = yield* Option.match(storeProduct, {
        onNone: () => Effect.fail(missingInput("the store product", usage)),
        onSome: (key) => locateStoreProduct(projectId, providers, key, provider),
      });
      const products = yield* readAll((query) => api.productsList(projectId, query));
      const wanted = yield* Option.match(product, {
        onNone: () => Effect.succeedNone,
        onSome: (input) => Effect.map(findItem(productKind, products, input), Option.some),
      });
      const where = `${providerLabel(store.provider)} ${store.providerProductKey}`;
      const candidates = store.mappings.filter((mapping) =>
        Option.match(wanted, { onNone: () => true, onSome: ({ id }) => mapping.productId === id }),
      );
      const [mapping, ...others] = candidates;
      if (mapping === undefined) {
        return yield* Effect.fail(
          userError(
            `${where} is not mapped${Option.match(wanted, { onNone: () => "", onSome: (found) => ` to ${productKind.label(found)}` })}.`,
            {
              exitCode: ExitCode.notFound,
            },
          ),
        );
      }
      if (Arr.isReadonlyArrayNonEmpty(others)) {
        return yield* Effect.fail(
          userError(`${where} is mapped to several products.`, {
            hint: "Pass the one to remove with --product.",
            exitCode: ExitCode.usage,
          }),
        );
      }
      const from = products.find(({ id }) => id === mapping.productId);
      const fromLabel = from === undefined ? mapping.productId : productKind.label(from);
      if (mapping.isActive) {
        yield* confirmChange({
          yes,
          message: `Unmap ${where} from ${fromLabel}? Buying it then grants nothing until it is mapped again.`,
        });
      }
      yield* api.paymentProviderProductsDelete(projectId, store.provider.id, mapping.id).pipe(
        Effect.mapError((error) =>
          apiError(error, {
            product_mapping_has_purchases: `Purchases were recorded under it, so it stays. Move it to another product with 'voidhash-cli provider map ${store.providerProductKey} <product>'.`,
          }),
        ),
      );
      yield* printItem(mode, mapping, `Unmapped ${where} from ${fromLabel}.`);
    }),
).pipe(
  Command.withDescription(
    "Remove a store product's mapping to a product made by mistake. A mapping purchases were recorded under stays; move it with 'provider map' instead.",
  ),
);

const ENVIRONMENTS = [
  ["production", "production"],
  ["test", "test"],
] as const;

const WATCH_INTERVAL = "2 seconds";

/** `voidhash-cli provider import <provider> [--environment] [--watch] [--cancel]` */
const providerImportCommand = Command.make(
  "import",
  {
    provider: providerArgument,
    environment: Flag.ChoiceWithValue("environment", ENVIRONMENTS).pipe(
      Flag.withDescription(
        "Which purchases: production (default) or test, such as Stripe's test mode or a payment source's test payments",
      ),
      Flag.withDefault("production" as const),
    ),
    watch: Flag.Boolean("watch").pipe(
      Flag.withDescription("Follow the import until it ends"),
      Flag.withDefault(false),
    ),
    cancel: Flag.Boolean("cancel").pipe(
      Flag.withDescription("Stop the running import instead; what it recorded stays"),
      Flag.withDefault(false),
    ),
    project: projectOption,
    ...outputOptions,
  },
  ({ cancel, environment, json, project, provider, quiet, watch }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const providers = yield* loadProviders(projectId);
      const importable = providers.filter(isImportable);
      const found = yield* Option.match(provider, {
        onSome: (input) => findItem(providerKind, providers, input),
        onNone: () =>
          Effect.gen(function* () {
            if (!(yield* isInteractive)) {
              return yield* Effect.fail(
                missingInput("the provider", "voidhash-cli provider import <provider>"),
              );
            }
            return yield* chooseItem(
              providerKind,
              importable,
              "Import the history of which provider?",
            );
          }),
      });
      if (!isImportable(found)) {
        return yield* Effect.fail(
          userError(`${providerLabel(found)} has no history to import.`, {
            hint: "App Store and Google Play purchases arrive from the apps and the stores' notifications; Stripe and payment sources import their history.",
            exitCode: ExitCode.usage,
          }),
        );
      }
      const handle = providerHandle(found);
      const latest = yield* readAll((query) =>
        api.paymentProviderHistoryImportsList(projectId, found.id, { ...query, environment }),
      );
      const running = latest.find(({ status }) => status === "running");
      const print = (historyImport: PaymentProviderHistoryImport, message: string) =>
        printItem(mode, historyImport, message);

      if (cancel) {
        if (running === undefined) {
          return yield* Effect.fail(
            userError(`No ${environment} import of ${providerLabel(found)} is running.`, {
              exitCode: ExitCode.notFound,
            }),
          );
        }
        const canceled = yield* api.paymentProviderHistoryImportsCancel(
          projectId,
          found.id,
          running.id,
        );
        return yield* print(canceled, `Stopped the import: ${describeImport(canceled)}.`);
      }

      const current =
        running ??
        (yield* api.paymentProviderHistoryImportsCreate(projectId, found.id, { environment }).pipe(
          Effect.mapError((error) =>
            apiError(error, {
              history_import_blocked:
                found.type === "stripe"
                  ? `Save its secret keys first: 'voidhash-cli provider connect stripe'.`
                  : environment === "test"
                    ? `Connect an endpoint first: 'voidhash-cli provider edit ${handle} --test-endpoint <url>', or --endpoint <url> for production too.`
                    : `Connect its endpoint first: 'voidhash-cli provider edit ${handle} --endpoint <url>'.`,
            }),
          ),
        ));
      if (mode === "human") {
        yield* Console.log(
          running === undefined
            ? `Started importing ${providerLabel(found)}'s ${environment} purchase history.`
            : `An import of ${providerLabel(found)}'s ${environment} purchase history is already running.`,
        );
      }
      if (!watch) {
        return yield* print(
          current,
          `  ${describeImport(current)}\nFollow it with 'voidhash-cli provider import ${handle} --watch'.`,
        );
      }
      if (mode === "human") yield* Console.log(`  ${describeImport(current)}`);
      const follow = (
        shown: PaymentProviderHistoryImport,
      ): Effect.Effect<PaymentProviderHistoryImport, ApiFailure> =>
        shown.status !== "running"
          ? Effect.succeed(shown)
          : Effect.sleep(WATCH_INTERVAL).pipe(
              Effect.andThen(api.paymentProviderHistoryImportsGet(projectId, found.id, shown.id)),
              Effect.tap((next) =>
                mode === "human" && describeImport(next) !== describeImport(shown)
                  ? Console.log(`  ${describeImport(next)}`)
                  : Effect.void,
              ),
              Effect.flatMap(follow),
            );
      const shown = yield* follow(current);
      if (mode === "json") yield* printJson(shown);
      if (mode === "quiet") yield* Console.log(shown.id);
      if (shown.status === "failed") {
        return yield* Effect.fail(
          userError(`The import failed${shown.lastError === null ? "." : `: ${shown.lastError}`}`, {
            hint: `Fix that, then run 'voidhash-cli provider import ${handle}' again; what it recorded stays.`,
          }),
        );
      }
      if (mode === "human" && shown.counts.parked > 0) {
        yield* Console.error(
          `${plural(shown.counts.parked, "purchase")} wait for store products to be mapped: 'voidhash-cli provider products ${handle} --unmapped'.`,
        );
      }
    }),
).pipe(
  Command.withDescription(
    "Import the purchases Stripe or a payment source recorded before Voidhash was connected, in the background. Running it again skips what is recorded; --watch follows it, --cancel stops it.",
  ),
);

/** `voidhash-cli provider edit <provider> [--name] [--enable | --disable] [--endpoint <url> | --disconnect-endpoint] [--rotate-secret] [--test-endpoint <url> | --disconnect-test-endpoint] [--rotate-test-secret]` */
const providerEditCommand = Command.make(
  "edit",
  {
    provider: providerArgument,
    name: Flag.String("name").pipe(Flag.withDescription("Its new name"), Flag.optional),
    enable: Flag.Boolean("enable").pipe(
      Flag.withDescription("Process its purchases again; a store's credentials are checked"),
      Flag.withDefault(false),
    ),
    disable: Flag.Boolean("disable").pipe(
      Flag.withDescription("Stop processing its purchases"),
      Flag.withDefault(false),
    ),
    endpoint: Flag.String("endpoint").pipe(
      Flag.withDescription(
        "A payment source's HTTPS endpoint, its server's provider handler; it serves production requests, and test ones without a test endpoint",
      ),
      Flag.optional,
    ),
    disconnectEndpoint: Flag.Boolean("disconnect-endpoint").pipe(
      Flag.withDescription("Stop calling a payment source's endpoint"),
      Flag.withDefault(false),
    ),
    rotateSecret: Flag.Boolean("rotate-secret").pipe(
      Flag.withDescription("Give a payment source's endpoint a new signing secret"),
      Flag.withDefault(false),
    ),
    testEndpoint: Flag.String("test-endpoint").pipe(
      Flag.withDescription(
        "A payment source's HTTPS endpoint for test requests only, such as its staging server's provider handler",
      ),
      Flag.optional,
    ),
    disconnectTestEndpoint: Flag.Boolean("disconnect-test-endpoint").pipe(
      Flag.withDescription(
        "Stop calling a payment source's test endpoint; test requests go to its endpoint",
      ),
      Flag.withDefault(false),
    ),
    rotateTestSecret: Flag.Boolean("rotate-test-secret").pipe(
      Flag.withDescription("Give a payment source's test endpoint a new signing secret"),
      Flag.withDefault(false),
    ),
    project: projectOption,
    yes: yesOption,
    ...outputOptions,
  },
  ({
    disable,
    disconnectEndpoint,
    disconnectTestEndpoint,
    enable,
    endpoint,
    json,
    name,
    project,
    provider,
    quiet,
    rotateSecret,
    rotateTestSecret,
    testEndpoint,
    yes,
  }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const usage = (message: string, hint?: string) =>
        Effect.fail(
          userError(message, { exitCode: ExitCode.usage, ...(hint === undefined ? {} : { hint }) }),
        );
      if (enable && disable) return yield* usage("--enable and --disable cannot be combined.");
      if (Option.isSome(endpoint) && disconnectEndpoint) {
        return yield* usage("--endpoint and --disconnect-endpoint cannot be combined.");
      }
      if (Option.isSome(testEndpoint) && disconnectTestEndpoint) {
        return yield* usage("--test-endpoint and --disconnect-test-endpoint cannot be combined.");
      }
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const found = yield* requireItem(
        providerKind,
        yield* loadProviders(projectId),
        provider,
        "voidhash-cli provider edit <provider> --name <name>",
      );
      const handle = providerHandle(found);
      const isSource = found.type === "payment_source";
      const changesEndpoint = Option.isSome(endpoint) || disconnectEndpoint || rotateSecret;
      const changesTestEndpoint =
        Option.isSome(testEndpoint) || disconnectTestEndpoint || rotateTestSecret;
      if (!isSource && (changesEndpoint || changesTestEndpoint)) {
        return yield* usage(
          "Only a payment source has an endpoint.",
          `Change a store's credentials with 'voidhash-cli provider connect ${handle}'.`,
        );
      }
      if (Option.isNone(name) && !enable && !disable && !changesEndpoint && !changesTestEndpoint) {
        return yield* usage(
          "Nothing to change.",
          isSource
            ? "Pass --name, --enable, --disable, --endpoint, --disconnect-endpoint, --rotate-secret, --test-endpoint, --disconnect-test-endpoint or --rotate-test-secret."
            : `Pass --name, --enable or --disable; 'voidhash-cli provider connect ${handle}' changes its credentials.`,
        );
      }
      /**
       * One endpoint after the edit: its URL, and a new signing secret when it
       * is connected for the first time or rotated. A changed URL keeps the secret.
       */
      const planEndpoint = (
        which: "endpoint" | "testEndpoint",
        given: Option.Option<string>,
        disconnect: boolean,
        rotate: boolean,
      ) => {
        const current = endpointUrlOf(found, which);
        const next = disconnect ? Option.none<string>() : Option.orElse(given, () => current);
        const signingSecret =
          Option.isSome(next) && (Option.isNone(current) || rotate)
            ? Option.some(newSigningSecret())
            : Option.none<string>();
        return {
          current,
          next,
          signingSecret,
          saved: Option.match(next, {
            onNone: () => null,
            onSome: (url) => ({
              url,
              signingSecret: Option.getOrElse(signingSecret, () => STORED_SECRET),
            }),
          }),
        };
      };
      const main = planEndpoint("endpoint", endpoint, disconnectEndpoint, rotateSecret);
      const test = planEndpoint(
        "testEndpoint",
        testEndpoint,
        disconnectTestEndpoint,
        rotateTestSecret,
      );
      if (rotateSecret && Option.isNone(main.next)) {
        return yield* usage(
          `${providerLabel(found)} has no endpoint to rotate the secret of.`,
          "Connect one with --endpoint <url>.",
        );
      }
      if (rotateTestSecret && Option.isNone(test.next)) {
        return yield* usage(
          `${providerLabel(found)} has no test endpoint to rotate the secret of.`,
          "Connect one with --test-endpoint <url>.",
        );
      }
      const risks = [
        ...(disable && found.isEnabled
          ? [
              isSource
                ? "the purchases it reports are refused"
                : "its purchases stop being processed",
            ]
          : []),
        ...(disconnectEndpoint && Option.isSome(main.current)
          ? [
              Option.isSome(test.next)
                ? "production imports, refunds and cancellations through its endpoint stop"
                : "imports, refunds and cancellations through its endpoint stop",
            ]
          : []),
        ...(rotateSecret ? ["its server's requests fail until it has the new secret"] : []),
        ...(disconnectTestEndpoint && Option.isSome(test.current)
          ? [
              Option.isSome(main.next)
                ? "test requests go to its endpoint instead"
                : "test imports, refunds and cancellations stop",
            ]
          : []),
        ...(rotateTestSecret
          ? ["its test server's requests fail until it has the new secret"]
          : []),
      ];
      if (Arr.isReadonlyArrayNonEmpty(risks)) {
        yield* confirmChange({
          yes,
          message: `Change ${providerLabel(found)} in ${projectKind(context.session).label(context.project)}? ${risks.join("; ")}.`,
        });
      }
      // The configuration is saved whole; the endpoint not edited goes back
      // as read, its secret as the stored-secret placeholder, so it stays.
      const updated = yield* api.paymentProvidersUpdate(projectId, found.id, {
        name: Option.getOrUndefined(name),
        isEnabled: enable ? true : disable ? false : undefined,
        configuration:
          changesEndpoint || changesTestEndpoint
            ? {
                ...found.configuration,
                ...(changesEndpoint ? { endpoint: main.saved } : {}),
                ...(changesTestEndpoint ? { testEndpoint: test.saved } : {}),
              }
            : undefined,
      });
      const shownSecrets = [
        ...Arr.fromOption(
          Option.map(main.signingSecret, (secret) => ({
            line: `Signing secret, shown once: ${secret}`,
            next: `Give it to the source's server (for example as VOIDHASH_PROVIDER_SECRET), then run 'voidhash-cli provider test ${handle}'.`,
          })),
        ),
        ...Arr.fromOption(
          Option.map(test.signingSecret, (secret) => ({
            line: `Test endpoint signing secret, shown once: ${secret}`,
            next: `Give it to the source's test (staging) server (for example as VOIDHASH_PROVIDER_SECRET), then run 'voidhash-cli provider test ${handle}'.`,
          })),
        ),
      ];
      yield* printItem(
        mode,
        updated,
        [
          `Updated ${providerLabel(updated)}.`,
          ...shownSecrets.flatMap(({ line, next }) => [line, next]),
        ].join("\n"),
      );
      if (mode !== "human") {
        yield* Effect.forEach(shownSecrets, ({ line }) => Console.error(line), {
          concurrency: 1,
          discard: true,
        });
      }
    }),
).pipe(
  Command.withDescription(
    "Rename a provider, enable or disable it, or connect, change or disconnect a payment source's endpoint and its test endpoint and rotate their signing secrets. Disabling, disconnecting and rotating ask first.",
  ),
);

/** `voidhash-cli provider delete <provider> [--yes]` */
const providerDeleteCommand = Command.make(
  "delete",
  { provider: providerArgument, project: projectOption, yes: yesOption, ...outputOptions },
  ({ json, project, provider, quiet, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const found = yield* requireItem(
        providerKind,
        yield* loadProviders(projectId),
        provider,
        "voidhash-cli provider delete <provider> --yes",
      );
      const handle = providerHandle(found);
      yield* confirmChange({
        yes,
        message: `Delete ${providerLabel(found)} from ${projectKind(context.session).label(context.project)}? ${
          found.type === "payment_source"
            ? "The purchases its backend reports are refused from then on"
            : "Its purchases stop being processed and its saved credentials are removed"
        }; what it recorded keeps its history. This cannot be undone.`,
      });
      yield* api.paymentProvidersDelete(projectId, found.id).pipe(
        Effect.mapError((error) =>
          apiError(error, {
            payment_provider_in_use: `Unmap its store products first: 'voidhash-cli provider products ${handle} --mapped' lists them, 'voidhash-cli provider unmap <store-product> --provider ${handle}' removes each. Or turn it off: 'voidhash-cli provider edit ${handle} --disable'.`,
          }),
        ),
      );
      yield* printItem(mode, found, `Deleted ${providerLabel(found)}.`);
    }),
).pipe(
  Command.withDescription(
    "Delete a payment provider that no store product is mapped to. Asks first; --yes skips that.",
  ),
);

/** `voidhash-cli provider …` */
export const providerCommand = Command.make("provider").pipe(
  Command.withAlias("providers"),
  Command.withDescription(
    "Where the project takes payments: connect the App Store, Google Play, Stripe or a payment source, check that they work, map their store products to products and import their purchase history.",
  ),
  Command.withSubcommands([
    providerListCommand,
    providerViewCommand,
    providerConnectCommand,
    providerTestCommand,
    providerEditCommand,
    providerProductsCommand,
    providerMapCommand,
    providerUnmapCommand,
    providerImportCommand,
    providerDeleteCommand,
    providerRecordPaymentCommand,
    providerRefundCommand,
    providerCancelSubscriptionCommand,
  ]),
);
