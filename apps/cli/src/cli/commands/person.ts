import type {
  AnalyticsEventJsonEncoding,
  FeatureFlagOverrideJsonEncoding,
  PerkJsonEncoding,
  PersonEntitlementJsonEncoding,
  PersonErasureJsonEncoding,
  PersonJsonEncoding,
  PersonPurchaseJsonEncoding,
  PersonSubscriptionJsonEncoding,
  ProductJsonEncoding,
} from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as R from "effect/Record";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import { Argument, Command, Flag } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { type ApiFailure, ExitCode, ifPermitted, userError } from "../../utils/error-formatter";
import { printable } from "../../utils/printable";
import { dashboardUrl, projectKind, readCliConfig, resolveProject } from "../context";
import { confirmByTypingName, findItem, requireText } from "../input";
import {
  formatDate,
  formatFields,
  formatTimeAgo,
  outputModeOf,
  printIds,
  printItem,
  printJson,
  printTable,
  terminalStyle,
} from "../output";
import { outputOptions, projectOption, yesOption } from "../shared-options";
import {
  personKind,
  personName,
  personsMatching,
  PERSONS_MATCHED_EXACTLY,
  requirePerson,
} from "../persons";
import { listStoreProducts, perkKind } from "./catalog";

const personArgument = Argument.String("person").pipe(
  Argument.withDescription(
    "The person's email, distinct id (the id your app identifies them by) or id",
  ),
  Argument.optional,
);

/** The dashboard page of the person `input` names, for `voidhash-cli open person <person>`. */
export const personPagePath = (projectId: string, input: Option.Option<string>) =>
  Effect.map(
    requirePerson(projectId, input, "voidhash-cli open person <person>"),
    (person) => `persons/${encodeURIComponent(person.distinctId)}`,
  );

/** An API time in epoch milliseconds; none when absent. */
const millisOf = (iso: Option.Option<string>) =>
  iso.pipe(Option.flatMap(DateTime.make), Option.map(DateTime.toEpochMillis));

/** An API time as people read it, or "-" when absent. */
const dateOf = (iso: Option.Option<string>) =>
  Option.match(iso, { onNone: () => "-", onSome: formatDate });

/** Where a subscription stands now. */
const subscriptionState = (subscription: PersonSubscriptionJsonEncoding, now: number) => {
  if (subscription.status === "canceled") return "ended" as const;
  if (
    !Option.exists(
      millisOf(Option.fromNullishOr(subscription.expiresAt)),
      (expires) => expires <= now,
    )
  ) {
    return subscription.isCancelingAtPeriodEnd ? ("canceling" as const) : ("active" as const);
  }
  return Option.exists(
    millisOf(Option.fromNullishOr(subscription.gracePeriodExpiresAt)),
    (grace) => grace > now,
  )
    ? ("grace period" as const)
    : ("lapsed" as const);
};

const isCurrent = (subscription: PersonSubscriptionJsonEncoding, now: number) => {
  const state = subscriptionState(subscription, now);
  return state !== "ended" && state !== "lapsed";
};

const describeSubscription = (
  subscription: PersonSubscriptionJsonEncoding,
  now: DateTime.DateTime,
) => {
  const state = subscriptionState(subscription, DateTime.toEpochMillis(now));
  const where = subscription.environment === "production" ? "" : ` [${subscription.environment}]`;
  const how = {
    active:
      subscription.expiresAt === null
        ? "active"
        : `active, renews ${dateOf(Option.fromNullishOr(subscription.expiresAt))}`,
    canceling: `canceled, access ends ${dateOf(Option.fromNullishOr(subscription.expiresAt))}`,
    "grace period": `payment failed, grace period until ${dateOf(Option.fromNullishOr(subscription.gracePeriodExpiresAt))}`,
    lapsed: `expired ${dateOf(Option.fromNullishOr(subscription.expiresAt))} without renewing`,
    ended: `ended ${dateOf(Option.fromNullishOr(subscription.expiresAt))}`,
  }[state];
  return `${subscription.productName}${where}: ${how}`;
};

const isOwned = (purchase: PersonPurchaseJsonEncoding) =>
  purchase.refundedAt === null && purchase.revokedAt === null;

const describePurchase = (purchase: PersonPurchaseJsonEncoding) => {
  const where = purchase.environment === "production" ? "" : ` [${purchase.environment}]`;
  const how =
    purchase.refundedAt !== null
      ? `refunded ${formatDate(purchase.refundedAt)}`
      : purchase.revokedAt !== null
        ? `revoked ${formatDate(purchase.revokedAt)}`
        : `bought ${purchase.createdAt === null ? "-" : formatDate(purchase.createdAt)}`;
  return `${purchase.productName}${where}: ${how}`;
};

/** What a person bought and can use, every page. */
const readHistory = (projectId: string, personId: string) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    const [subscriptions, purchases, entitlements] = yield* Effect.all(
      [
        readAll((query) => api.personsListSubscriptions(projectId, personId, query)),
        readAll((query) => api.personsListPurchases(projectId, personId, query)),
        ifPermitted(readAll((query) => api.personsListEntitlements(projectId, personId, query))),
      ],
      { concurrency: 3 },
    );
    return { subscriptions, purchases, entitlements };
  });

const describeEntitlement = (
  entitlement: PersonEntitlementJsonEncoding,
  history: {
    readonly subscriptions: ReadonlyArray<PersonSubscriptionJsonEncoding>;
    readonly purchases: ReadonlyArray<PersonPurchaseJsonEncoding>;
  },
) => {
  const source = Option.fromNullishOr(
    entitlement.source === "subscription"
      ? history.subscriptions.find(({ id }) => id === entitlement.sourceId)?.productName
      : history.purchases.find(({ id }) => id === entitlement.sourceId)?.productName,
  );
  const from =
    entitlement.source === "manual"
      ? "granted manually"
      : Option.match(source, {
          onNone: () => `from a ${entitlement.source}`,
          onSome: (product) => `${product} ${entitlement.source}`,
        });
  const until =
    entitlement.expiresAt === null ? "" : `, until ${formatDate(entitlement.expiresAt)}`;
  return `${entitlement.perkSlug ?? `deleted perk ${entitlement.perkId}`}: ${from}${until}`;
};

/** How many of the project's newest events `person view` searches for the person's. */
const EVENT_SCAN = 300;

/** The person's events among the project's newest {@link EVENT_SCAN}; events cannot be filtered by person. */
const recentEventsOf = (projectId: string, person: PersonJsonEncoding) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    const scan = (
      cursor: Option.Option<string>,
      read: ReadonlyArray<AnalyticsEventJsonEncoding>,
    ): Effect.Effect<ReadonlyArray<AnalyticsEventJsonEncoding>, ApiFailure> =>
      api.eventsList(projectId, { limit: 100, cursor: Option.getOrUndefined(cursor) }).pipe(
        Effect.flatMap((page) => {
          const events = [...read, ...page.data];
          const next = Option.fromNullishOr(page.pageInfo.endCursor);
          return page.pageInfo.hasNextPage && Option.isSome(next) && events.length < EVENT_SCAN
            ? scan(next, events)
            : Effect.succeed(events);
        }),
      );
    const events = yield* scan(Option.none(), []);
    return events.filter(
      (event) => event.personId === person.id || event.distinctId === person.distinctId,
    );
  });

/** The flag overrides naming the person by id, distinct id or email, with the flags' keys. */
const overridesOf = (projectId: string, person: PersonJsonEncoding) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    const identities = [
      `person_id:${person.id}`,
      `distinct_id:${person.distinctId}`,
      ...(person.email === null ? [] : [`email:${person.email}`]),
    ];
    const [overrides, flags] = yield* Effect.all(
      [
        Effect.forEach(
          identities,
          (identity) =>
            readAll((query) =>
              api.featureFlagsListOverridesByIdentity(projectId, { ...query, identity }),
            ),
          { concurrency: 3 },
        ),
        readAll((query) => api.featureFlagsList(projectId, query)),
      ],
      { concurrency: 2 },
    );
    return overrides.flat().map((override) => ({
      override,
      flagKey: Option.fromNullishOr(flags.find(({ id }) => id === override.featureFlagId)?.key),
    }));
  });

const describeOverride = (
  override: FeatureFlagOverrideJsonEncoding,
  flagKey: Option.Option<string>,
) => {
  const value =
    override.variantKey !== null
      ? `variant ${override.variantKey}`
      : override.isEnabled === null
        ? "unchanged"
        : override.isEnabled
          ? "on"
          : "off";
  return `${Option.getOrElse(flagKey, () => override.featureFlagId)}: ${value} (by ${override.identityType.replace("_", " ")})`;
};

const lines = (items: ReadonlyArray<string>, empty: string) =>
  Arr.match(items, { onEmpty: () => empty, onNonEmpty: (some) => some.join("\n") });

/** `voidhash-cli person list [--limit <n>]` */
const personListCommand = Command.make(
  "list",
  {
    project: projectOption,
    limit: Flag.Int("limit").pipe(
      Flag.withDescription("How many of the newest persons to show, at most 100"),
      Flag.withDefault(20),
    ),
    ...outputOptions,
  },
  ({ json, limit, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      if (limit < 1 || limit > 100) {
        return yield* Effect.fail(
          userError("--limit takes 1 to 100.", { exitCode: ExitCode.usage }),
        );
      }
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const page = yield* api.personsList(projectId, { limit: limit });
      if (mode === "json") return yield* printJson(page.data);
      if (mode === "quiet") return yield* printIds(page.data);
      const now = yield* DateTime.now;
      yield* printTable(
        [
          { header: "PERSON", cell: (person) => personName(person) },
          { header: "DISTINCT ID", cell: (person) => person.distinctId },
          { header: "IDENTIFIED", cell: (person) => (person.isIdentified ? "yes" : "no") },
          {
            header: "FIRST SEEN",
            cell: (person) =>
              person.createdAt === null ? "-" : formatTimeAgo(person.createdAt, now),
          },
          { header: "ID", cell: (person) => person.id },
        ],
        page.data,
        "No persons yet. The SDK adds one when your app first runs.",
      );
      if (page.pageInfo.hasNextPage) {
        yield* Console.error(
          `Showing the ${limit} newest. Find someone with 'voidhash-cli person find <email or distinct id>'.`,
        );
      }
    }),
).pipe(Command.withDescription("List the project's newest persons."));

/** `voidhash-cli person find <query>` */
const personFindCommand = Command.make(
  "find",
  {
    query: Argument.String("query").pipe(
      Argument.withDescription("An exact email, distinct id or person id"),
    ),
    project: projectOption,
    ...outputOptions,
  },
  ({ json, project, query, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const projectId = (yield* resolveProject(project)).project.id;
      const matches = (yield* personsMatching(projectId, query)).persons;
      if (mode === "json") return yield* printJson(matches);
      if (mode === "quiet") return yield* printIds(matches);
      if (Arr.isReadonlyArrayEmpty(matches)) {
        return yield* Effect.fail(
          userError(`No person has the email, distinct id or id "${query}".`, {
            hint: PERSONS_MATCHED_EXACTLY,
            exitCode: ExitCode.notFound,
          }),
        );
      }
      yield* printTable(
        [
          { header: "PERSON", cell: (person) => personName(person) },
          { header: "DISTINCT ID", cell: (person) => person.distinctId },
          { header: "EMAIL", cell: (person) => person.email ?? "-" },
          { header: "ID", cell: (person) => person.id },
        ],
        matches,
        "",
      );
      yield* Console.error(
        // By its id: an end user chooses a distinct id, and this line is meant to be pasted.
        `See one with 'voidhash-cli person view ${printable(matches[0]?.id ?? query)}'.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Find persons by their exact email, distinct id or id. Names cannot be searched.",
  ),
);

/** `voidhash-cli person view <person>` */
const personViewCommand = Command.make(
  "view",
  { person: personArgument, project: projectOption, ...outputOptions },
  ({ json, person, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const found = yield* requirePerson(projectId, person, "voidhash-cli person view <person>");
      if (mode === "quiet") return yield* printIds([found]);
      const [history, overrides, events] = yield* Effect.all(
        [
          readHistory(projectId, found.id),
          ifPermitted(overridesOf(projectId, found)),
          ifPermitted(recentEventsOf(projectId, found)),
        ],
        { concurrency: 3 },
      );
      if (mode === "json") {
        return yield* printJson({
          ...found,
          entitlements: Option.getOrNull(history.entitlements),
          subscriptions: history.subscriptions,
          purchases: history.purchases,
          flagOverrides: Option.getOrNull(
            Option.map(overrides, (list) => list.map(({ override }) => override)),
          ),
          recentEvents: Option.getOrNull(Option.map(events, (list) => list.slice(0, 20))),
        });
      }
      const now = yield* DateTime.now;
      const hidden = "not shown: your access does not include it";
      const { web_url } = yield* readCliConfig;
      yield* Console.log(
        [
          `${personName(found)}${found.isIdentified ? "" : " (anonymous)"}`,
          formatFields([
            ["Distinct id", printable(found.distinctId)],
            ["Email", printable(found.email ?? "-")],
            ["First seen", found.createdAt === null ? "-" : formatTimeAgo(found.createdAt, now)],
            [
              "Access",
              Option.match(history.entitlements, {
                onNone: () => hidden,
                onSome: (entitlements) =>
                  lines(
                    entitlements.map((entitlement) => describeEntitlement(entitlement, history)),
                    `none; 'voidhash-cli person why ${found.id} <perk>' explains why`,
                  ),
              }),
            ],
            [
              "Subscriptions",
              lines(
                history.subscriptions.map((subscription) =>
                  describeSubscription(subscription, now),
                ),
                "none",
              ),
            ],
            ["Purchases", lines(history.purchases.map(describePurchase), "none")],
            [
              "Flag overrides",
              Option.match(overrides, {
                onNone: () => hidden,
                onSome: (list) =>
                  lines(
                    list.map(({ override, flagKey }) => describeOverride(override, flagKey)),
                    "none",
                  ),
              }),
            ],
            [
              "Recent events",
              Option.match(events, {
                onNone: () => hidden,
                onSome: (list) =>
                  lines(
                    list
                      .slice(0, 10)
                      .map((event) => `${event.name}  ${formatTimeAgo(event.timestamp, now)}`),
                    `none among the project's ${EVENT_SCAN} newest events`,
                  ),
              }),
            ],
            ["ID", found.id],
            ...Arr.fromOption(
              Option.map(
                dashboardUrl(web_url, context, `persons/${encodeURIComponent(found.distinctId)}`),
                (url) => ["Dashboard", url] as const,
              ),
            ),
          ]),
        ].join("\n"),
      );
      yield* Console.error(
        "Only production store purchases are shown. Attributes are shown in the dashboard.",
      );
    }),
).pipe(
  Command.withDescription(
    "Show a person: their profile, the perks they can use and why, subscriptions, purchases, flag overrides and recent events.",
  ),
);

/** One link of the access chain `person why` prints. */
interface Link {
  readonly name: string;
  readonly ok: Option.Option<boolean>;
  readonly detail: string;
}

/** `voidhash-cli person why <person> <perk>` */
const personWhyCommand = Command.make(
  "why",
  {
    person: personArgument,
    perk: Argument.String("perk").pipe(
      Argument.withDescription("The perk's slug (what your app checks), name or id"),
      Argument.optional,
    ),
    project: projectOption,
    json: outputOptions.json,
  },
  ({ json, perk, person, project }) =>
    Effect.gen(function* () {
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const usage = "voidhash-cli person why <person> <perk>";
      const found = yield* requirePerson(projectId, person, usage);
      const perks = yield* readAll((query) => api.perksList(projectId, query));
      const wanted = yield* findItem(
        perkKind,
        perks,
        yield* requireText(perk, { flag: "the perk", message: "Which perk (its slug)?", usage }),
      );
      const now = yield* DateTime.now;
      const nowMillis = DateTime.toEpochMillis(now);
      const history = yield* readHistory(projectId, found.id);
      const chain: Array<Link> = [];
      const report = (hasAccess: boolean, fix: Option.Option<string>) =>
        Effect.gen(function* () {
          if (json) {
            return yield* printJson({
              person: found,
              perk: wanted,
              hasAccess,
              chain: chain.map((link) => ({ ...link, ok: Option.getOrNull(link.ok) })),
              fix: Option.getOrNull(fix),
            });
          }
          const style = yield* terminalStyle;
          yield* Console.log(
            [
              `${personKind.label(found)} ${hasAccess ? style.green("has") : style.red("does not have")} ${printable(perkKind.label(wanted))}.`,
              ...chain.map(
                (link) =>
                  `  ${Option.match(link.ok, {
                    onNone: () => style.dim("?"),
                    onSome: (ok) => (ok ? style.green("ok") : style.red("x ")),
                  })}  ${link.name.padEnd(9)} ${printable(link.detail)}`,
              ),
              ...Arr.fromOption(Option.map(fix, (how) => `Fix: ${printable(how)}`)),
            ].join("\n"),
          );
        });

      const grant = Option.flatMap(history.entitlements, (entitlements) =>
        Arr.findFirst(entitlements, (entitlement) => entitlement.perkId === wanted.id),
      );
      if (Option.isSome(grant)) {
        chain.push({
          name: "access",
          ok: Option.some(true),
          detail: describeEntitlement(grant.value, history),
        });
        return yield* report(true, Option.none());
      }
      chain.push({
        name: "access",
        ok: Option.isNone(history.entitlements) ? Option.none() : Option.some(false),
        detail: Option.isNone(history.entitlements)
          ? "not checked: your access does not include entitlements"
          : `they cannot use ${wanted.slug} now`,
      });

      const products = yield* readAll((query) => api.productsList(projectId, query));
      const granting = (yield* Effect.forEach(
        products,
        (product) =>
          readAll((query) => api.productsListPerks(projectId, product.id, query)).pipe(
            Effect.map((granted): ReadonlyArray<ProductJsonEncoding> =>
              granted.some(({ id }) => id === wanted.id) ? [product] : [],
            ),
          ),
        { concurrency: 8 },
      )).flat();
      const names = (list: ReadonlyArray<ProductJsonEncoding | PerkJsonEncoding>) =>
        list.map(({ name }) => name).join(", ");
      if (Arr.isReadonlyArrayEmpty(granting)) {
        chain.push({
          name: "catalog",
          ok: Option.some(false),
          detail: `no product grants ${wanted.slug}`,
        });
        return yield* report(
          false,
          Option.some(
            `make the product they bought grant it: 'voidhash-cli product perks set <product> ${wanted.slug} …'`,
          ),
        );
      }
      chain.push({
        name: "catalog",
        ok: Option.some(true),
        detail: `granted by ${names(granting)}`,
      });

      const stores = yield* ifPermitted(listStoreProducts(projectId));
      const selling = Option.map(stores, ({ storeProducts }) =>
        storeProducts.filter(
          ({ mapping }) => mapping.isActive && granting.some(({ id }) => id === mapping.productId),
        ),
      );
      chain.push(
        Option.match(selling, {
          onNone: () => ({
            name: "store",
            ok: Option.none(),
            detail: "not checked: your access does not include payment providers",
          }),
          onSome: (mapped) =>
            Arr.isReadonlyArrayEmpty(mapped)
              ? {
                  name: "store",
                  ok: Option.some(false),
                  detail: `${names(granting)}: no active store product`,
                }
              : {
                  name: "store",
                  ok: Option.some(true),
                  detail: mapped.map(({ mapping }) => mapping.providerProductKey).join(", "),
                },
        }),
      );
      const isUnsold = Option.exists(selling, Arr.isReadonlyArrayEmpty);

      // Purchases name their product only by name.
      const grantingNames = granting.map(({ name }) => name);
      const theirs = {
        subscriptions: history.subscriptions.filter(({ productName }) =>
          grantingNames.includes(productName),
        ),
        purchases: history.purchases.filter(({ productName }) =>
          grantingNames.includes(productName),
        ),
      };
      const current = [
        ...theirs.subscriptions
          .filter((subscription) => isCurrent(subscription, nowMillis))
          .map((subscription) => describeSubscription(subscription, now)),
        ...theirs.purchases.filter(isOwned).map(describePurchase),
      ];
      if (Arr.isReadonlyArrayNonEmpty(current)) {
        chain.push({ name: "purchase", ok: Option.some(true), detail: current.join("; ") });
        chain.push({ name: "grant", ok: Option.some(false), detail: `missing for ${wanted.slug}` });
        return yield* report(
          false,
          Option.some(
            "access is recomputed in the background after a product's perks change; if it persists, contact Voidhash support.",
          ),
        );
      }
      const ended = [
        ...theirs.subscriptions.map((subscription) => describeSubscription(subscription, now)),
        ...theirs.purchases.map(describePurchase),
      ];
      if (Arr.isReadonlyArrayNonEmpty(ended)) {
        chain.push({ name: "purchase", ok: Option.some(false), detail: ended.join("; ") });
        return yield* report(
          false,
          Option.some(
            "access returns when they renew or buy again. If they say they renewed, check the store connection with 'voidhash-cli status'.",
          ),
        );
      }
      const other = Arr.dedupe([
        ...history.subscriptions
          .filter((subscription) => isCurrent(subscription, nowMillis))
          .map(({ productName }) => productName),
        ...history.purchases.filter(isOwned).map(({ productName }) => productName),
      ]);
      if (Arr.isReadonlyArrayNonEmpty(other)) {
        chain.push({
          name: "purchase",
          ok: Option.some(false),
          detail: `they have ${other.join(", ")}, which does not grant ${wanted.slug}`,
        });
        return yield* report(
          false,
          Option.some(
            `if ${other.join(" or ")} should unlock it, add ${wanted.slug} with 'voidhash-cli product perks set'; otherwise they need ${names(granting)}.`,
          ),
        );
      }
      chain.push({
        name: "purchase",
        ok: Option.some(false),
        detail: "no production purchase or subscription recorded",
      });
      return yield* report(
        false,
        Option.some(
          [
            "if they paid, the likely causes are:",
            ...(isUnsold
              ? ["  - the product has no store product yet: map it in the dashboard"]
              : []),
            ...(found.isIdentified
              ? []
              : [
                  "  - they are anonymous: the purchase may be on the person your app identified them as",
                ]),
            "  - a test purchase (a debug build's or Stripe test mode's), which production never counts, or a store sandbox one while the project keeps those out of production",
            "  - store notifications are not reaching Voidhash: 'voidhash-cli status' checks the connection",
          ].join("\n"),
        ),
      );
    }),
).pipe(
  Command.withDescription(
    "Explain why a person has or lacks a perk: their access, the products that grant it, the store products and their purchases, and where it breaks.",
  ),
);

/** A trait value from the command line: a number, true, false or null as JSON; anything else as text. */
const traitValue = (text: string) =>
  Option.getOrElse(
    Schema.decodeUnknownOption(
      Schema.fromJsonString(Schema.Union([Schema.Number, Schema.Boolean, Schema.Null])),
    )(text),
    () => text,
  );

/** `key=value` pairs as attributes, or a usage failure naming the malformed one. */
const parseAttributes = (flag: string, pairs: ReadonlyArray<string>) =>
  Effect.forEach(
    pairs,
    (pair) => {
      const separator = pair.indexOf("=");
      return separator <= 0
        ? Effect.fail(
            userError(`${flag} takes key=value; "${pair}" has no key.`, {
              exitCode: ExitCode.usage,
            }),
          )
        : Effect.succeed([
            pair.slice(0, separator),
            traitValue(pair.slice(separator + 1)),
          ] as const);
    },
    { concurrency: 1 },
  ).pipe(Effect.map((entries) => R.fromEntries(entries)));

/** `voidhash-cli person edit <person> [--email] [--name] [--set key=value]… [--set-once key=value]…` */
const personEditCommand = Command.make(
  "edit",
  {
    person: personArgument,
    project: projectOption,
    email: Flag.String("email").pipe(Flag.withDescription("Their new email"), Flag.optional),
    name: Flag.String("name").pipe(Flag.withDescription("Their new name"), Flag.optional),
    set: Flag.String("set").pipe(
      Flag.withDescription(
        "An attribute to set, as key=value (numbers, true, false and null as such); repeat for each",
      ),
      Flag.atLeast(0),
    ),
    setOnce: Flag.String("set-once").pipe(
      Flag.withDescription("An attribute to set only when they have none yet, as key=value"),
      Flag.atLeast(0),
    ),
    ...outputOptions,
  },
  ({ email, json, name, person, project, quiet, set, setOnce }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      if (
        Option.isNone(email) &&
        Option.isNone(name) &&
        Arr.isReadonlyArrayEmpty(set) &&
        Arr.isReadonlyArrayEmpty(setOnce)
      ) {
        return yield* Effect.fail(
          userError("Nothing to change.", {
            hint: "Pass --email, --name, --set key=value or --set-once key=value.",
            exitCode: ExitCode.usage,
          }),
        );
      }
      const [traits, once] = yield* Effect.all(
        [parseAttributes("--set", set), parseAttributes("--set-once", setOnce)],
        { concurrency: 1 },
      );
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const found = yield* requirePerson(
        projectId,
        person,
        "voidhash-cli person edit <person> --email <email>",
      );
      const updated = yield* api.personsUpdate(projectId, found.id, {
        email: Option.getOrUndefined(email),
        name: Option.getOrUndefined(name),
        traits: Arr.isReadonlyArrayEmpty(set) ? undefined : traits,
        setOnce: Arr.isReadonlyArrayEmpty(setOnce) ? undefined : once,
      });
      yield* printItem(
        mode,
        updated,
        [
          `Updated ${personKind.label(updated)}.`,
          "Your app's SDK may overwrite these the next time it sets them: the newest write wins.",
        ].join("\n"),
      );
    }),
).pipe(Command.withDescription("Change a person's email, name or attributes."));

/** `voidhash-cli person create --distinct-id <id> [--email] [--name]` */
const personCreateCommand = Command.make(
  "create",
  {
    project: projectOption,
    distinctId: Flag.String("distinct-id").pipe(
      Flag.withDescription("The id your app will identify them by, such as your user id"),
      Flag.optional,
    ),
    email: Flag.String("email").pipe(Flag.withDescription("Their email"), Flag.optional),
    name: Flag.String("name").pipe(Flag.withDescription("Their name"), Flag.optional),
    ...outputOptions,
  },
  ({ distinctId, email, json, name, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const id = yield* requireText(distinctId, {
        flag: "--distinct-id",
        message: "The id your app will identify them by",
        usage: "voidhash-cli person create --distinct-id <id> [--email <email>]",
      });
      const existing = yield* api.personsList(projectId, { distinctId: id });
      const [known] = existing.data;
      if (known !== undefined) {
        return yield* printItem(
          mode,
          known,
          `${personKind.label(known)} already has the distinct id ${id}; nothing changed. Change them with 'voidhash-cli person edit ${id}'.`,
        );
      }
      const created = yield* api.personsCreate(projectId, {
        distinctId: id,
        email: Option.getOrUndefined(email),
        name: Option.getOrUndefined(name),
      });
      yield* printItem(
        mode,
        created,
        `Created ${personKind.label(created)}. Your app reaches them when it identifies them as ${created.distinctId}.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Add a person before your app has seen them, by the distinct id it will identify them by.",
  ),
);

const isFinished = (erasure: PersonErasureJsonEncoding) =>
  erasure.status === "completed" || erasure.status === "failed";

/** How long `person erase` waits for the erasure before leaving it to finish in the background. */
const ERASURE_WAIT_SECONDS = 60;

/** `voidhash-cli person erase <person> [--yes] [--no-wait]` */
const personEraseCommand = Command.make(
  "erase",
  {
    person: personArgument,
    project: projectOption,
    yes: yesOption,
    wait: Flag.Boolean("wait").pipe(
      Flag.withDescription(
        "Wait for the erasure to finish; --no-wait returns once it is requested",
      ),
      Flag.withDefault(true),
    ),
    ...outputOptions,
  },
  ({ json, person, project, quiet, wait, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const found = yield* requirePerson(
        projectId,
        person,
        "voidhash-cli person erase <person> --yes",
      );
      const identifier = found.email ?? found.distinctId;
      yield* confirmByTypingName({
        yes,
        message: `Erase the personal data of ${personKind.label(found)} in ${projectKind(context.session).label(context.project)}? Their profile, attributes, distinct ids and the personal data in their events are erased for good; their purchases and access stay, anonymized.`,
        name: identifier,
      });
      const requested = yield* api.personsCreateErasure(projectId, { personId: found.id });
      // The erasure runs in the background; most finish within seconds.
      const erasure =
        wait && !isFinished(requested)
          ? yield* api.personsGetErasure(projectId, requested.id).pipe(
              Effect.delay("1 second"),
              Effect.repeat({
                until: isFinished,
                schedule: Schedule.spaced("1 second"),
                times: ERASURE_WAIT_SECONDS,
              }),
            )
          : requested;
      if (erasure.status === "failed") {
        return yield* Effect.fail(
          userError(`The erasure of ${personKind.label(found)} failed.`, {
            hint: `Run 'voidhash-cli person erase ${found.id}' again to retry it.`,
          }),
        );
      }
      yield* printItem(
        mode,
        erasure,
        erasure.status === "completed"
          ? `Erased the personal data of ${personKind.label(found)}.`
          : `Requested the erasure of ${personKind.label(found)} (${erasure.id}); it finishes in the background.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Erase a person's personal data for good, for a data deletion request. Asks you to type their email or distinct id; --yes skips that.",
  ),
);

/** `voidhash-cli person …` */
export const personCommand = Command.make("person").pipe(
  Command.withAlias("persons"),
  Command.withDescription(
    "The people using your app: find them, see what they bought and can use, explain their access, edit them, and erase their data.",
  ),
  Command.withSubcommands([
    personListCommand,
    personFindCommand,
    personViewCommand,
    personWhyCommand,
    personEditCommand,
    personCreateCommand,
    personEraseCommand,
  ]),
);
