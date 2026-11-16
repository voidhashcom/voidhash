import type {
  CreateSandboxActionBodyJsonEncodingAction,
  PersonJsonEncoding,
} from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Argument, Command } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { apiError, ExitCode, userError } from "../../utils/error-formatter";
import { projectKind, resolveProject } from "../context";
import { chooseItem, confirmChange, findItem, isInteractive } from "../input";
import { formatDate, formatFields, printJson } from "../output";
import { outputOptions, projectOption, yesOption } from "../shared-options";
import { productKind } from "./catalog";
import { personKind, requirePerson } from "../persons";
import { randomId } from "./workspace";

const personArgument = Argument.String("person").pipe(
  Argument.withDescription("The person's distinct id, email or id"),
  Argument.optional,
);

/** A sandbox purchase or subscription an action can target. */
interface Target {
  readonly id: string;
  readonly type: "purchase" | "subscription";
  readonly productId: string;
  readonly summary: string;
}

/** The person's sandbox state with the names of products and perks. */
const readState = (projectId: string, person: PersonJsonEncoding) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    const [state, products, perks] = yield* Effect.all(
      [
        api.sandboxGetState(projectId, { personId: person.id }),
        readAll((query) => api.productsList(projectId, query)),
        readAll((query) => api.perksList(projectId, query)),
      ],
      { concurrency: 3 },
    );
    const productName = (id: string) =>
      Option.match(
        Arr.findFirst(products, (product) => product.id === id),
        { onNone: () => id, onSome: productKind.label },
      );
    const perkSlug = (id: string) =>
      Option.match(
        Arr.findFirst(perks, (perk) => perk.id === id),
        { onNone: () => id, onSome: ({ slug }) => slug },
      );
    return { state, products, productName, perkSlug };
  });

/** " until <date>" for an end time, empty for none. */
const until = (end: Option.Option<string>) =>
  Option.match(end, { onNone: () => "", onSome: (iso) => ` until ${formatDate(iso)}` });

/** What a person's simulated purchases and access are, for people. */
const describeState = (
  person: PersonJsonEncoding,
  read: Effect.Success<ReturnType<typeof readState>>,
) => {
  const { state, productName, perkSlug } = read;
  const subscriptions = state.subscriptions.map(
    (subscription) =>
      `${productName(subscription.productId)}: ${subscription.status === "active" ? "active" : "canceled"}${until(Option.fromNullishOr(subscription.expiresAt))}${subscription.gracePeriodExpiresAt === null ? "" : `, in grace period until ${formatDate(subscription.gracePeriodExpiresAt)}`}  ${subscription.id}`,
  );
  const purchases = state.purchases.map(
    (purchase) =>
      `${productName(purchase.productId)}: ${purchase.refundedAt !== null ? "refunded" : purchase.revokedAt !== null ? "revoked" : "owned"}  ${purchase.id}`,
  );
  const access = state.grants.map(
    (grant) =>
      `${perkSlug(grant.perkId)}: ${grant.status}${until(Option.fromNullishOr(grant.expiresAt))}`,
  );
  const lines = (items: ReadonlyArray<string>) =>
    Arr.match(items, { onEmpty: () => "none", onNonEmpty: (some) => some.join("\n") });
  return [
    `Simulated purchases of ${personKind.label(person)}`,
    formatFields([
      ["Subscriptions", lines(subscriptions)],
      ["Purchases", lines(purchases)],
      ["Access", lines(access)],
    ]),
  ].join("\n");
};

const NO_PURCHASES =
  "Buy in a debug build of your app in development mode first, configured with the test publishable key; 'voidhash-cli settings set sandbox-purchasing on' allows it.";

/** `voidhash-cli sandbox view <person>` */
const sandboxViewCommand = Command.make(
  "view",
  { person: personArgument, project: projectOption, json: outputOptions.json },
  ({ json, person, project }) =>
    Effect.gen(function* () {
      const projectId = (yield* resolveProject(project)).project.id;
      const found = yield* requirePerson(projectId, person, "voidhash-cli sandbox view <person>");
      const read = yield* readState(projectId, found);
      if (json) return yield* printJson(read.state);
      yield* Console.log(describeState(found, read));
      if (
        Arr.isReadonlyArrayEmpty(read.state.purchases) &&
        Arr.isReadonlyArrayEmpty(read.state.subscriptions)
      ) {
        yield* Console.error(NO_PURCHASES);
      }
    }),
).pipe(
  Command.withDescription(
    "Show a person's simulated purchases and subscriptions and the access they grant.",
  ),
);

/** Which targets each action applies to, and how it reads. */
const ACTIONS: Readonly<
  Record<
    CreateSandboxActionBodyJsonEncodingAction,
    {
      readonly verb: string;
      readonly targets: ReadonlyArray<Target["type"]>;
      readonly done: string;
      readonly description: string;
    }
  >
> = {
  renew: {
    verb: "renew",
    targets: ["subscription"],
    done: "Renewed",
    description: "Renew a person's simulated subscription for another period, as the store would.",
  },
  expire: {
    verb: "expire",
    targets: ["subscription"],
    done: "Expired",
    description: "End a person's simulated subscription now, as when it lapses in the store.",
  },
  grace_period: {
    verb: "grace-period",
    targets: ["subscription"],
    done: "Started the three-day grace period of",
    description:
      "Put a person's simulated subscription in its three-day billing grace period, as after a failed renewal.",
  },
  refund: {
    verb: "refund",
    targets: ["purchase"],
    done: "Refunded",
    description: "Refund a person's one-time simulated purchase; the access it granted ends.",
  },
  revoke: {
    verb: "revoke",
    targets: ["purchase", "subscription"],
    done: "Revoked",
    description:
      "Revoke a person's simulated purchase or subscription, as when the store takes it back.",
  },
};

const targetKind = {
  noun: "simulated purchase",
  label: (target: Target) => target.summary,
  listCommand: "voidhash-cli sandbox view <person>",
  keys: () => [],
  names: () => [],
};

/** `voidhash-cli sandbox <action> <person> [product]` */
const sandboxActionCommand = (action: CreateSandboxActionBodyJsonEncodingAction) => {
  const { verb, targets, done, description } = ACTIONS[action];
  const usage = `voidhash-cli sandbox ${verb} <person> [product]`;
  return Command.make(
    verb,
    {
      person: personArgument,
      product: Argument.String("product").pipe(
        Argument.withDescription("The product bought, by slug, name or id, when they have several"),
        Argument.optional,
      ),
      project: projectOption,
      json: outputOptions.json,
    },
    ({ json, person, product, project }) =>
      Effect.gen(function* () {
        const api = yield* ApiClient;
        const projectId = (yield* resolveProject(project)).project.id;
        const found = yield* requirePerson(projectId, person, usage);
        const before = yield* readState(projectId, found);
        const candidates: ReadonlyArray<Target> = [
          ...(targets.includes("subscription")
            ? before.state.subscriptions
                .filter((subscription) => subscription.status === "active")
                .map((subscription): Target => ({
                  id: subscription.id,
                  type: "subscription",
                  productId: subscription.productId,
                  summary: `${before.productName(subscription.productId)} subscription${until(Option.fromNullishOr(subscription.expiresAt))}`,
                }))
            : []),
          ...(targets.includes("purchase")
            ? before.state.purchases
                .filter((purchase) => purchase.refundedAt === null && purchase.revokedAt === null)
                .map((purchase): Target => ({
                  id: purchase.id,
                  type: "purchase",
                  productId: purchase.productId,
                  summary: `${before.productName(purchase.productId)} purchase`,
                }))
            : []),
        ];
        const what = targets.map((type) => `active simulated ${type}`).join(" or ");
        const matching = Option.isSome(product)
          ? yield* Effect.map(findItem(productKind, before.products, product.value), (wanted) =>
              candidates.filter((target) => target.productId === wanted.id),
            )
          : candidates;
        const [only, ...others] = matching;
        if (only === undefined) {
          return yield* Effect.fail(
            userError(
              `${personKind.label(found)} has no ${what}${Option.isSome(product) ? ` of ${product.value}` : ""}.`,
              {
                hint: Arr.isReadonlyArrayEmpty(candidates)
                  ? NO_PURCHASES
                  : `'voidhash-cli sandbox view ${found.id}' shows what they have.`,
                exitCode: ExitCode.notFound,
              },
            ),
          );
        }
        const target = Arr.isReadonlyArrayEmpty(others)
          ? only
          : (yield* isInteractive)
            ? yield* chooseItem(targetKind, matching, `Which ${what}?`)
            : yield* Effect.fail(
                userError(
                  [
                    `${personKind.label(found)} has ${matching.length} of them:`,
                    ...matching.map((item) => `  ${item.summary}`),
                  ].join("\n"),
                  { hint: `Name the product: ${usage}`, exitCode: ExitCode.usage },
                ),
              );
        yield* api
          .sandboxCreateAction(projectId, {
            actionId: yield* randomId,
            action,
            targetType: target.type,
            targetId: target.id,
          })
          .pipe(
            Effect.mapError((error) => apiError(error, { sandbox_target_not_found: NO_PURCHASES })),
          );
        const after = yield* readState(projectId, found);
        if (json) return yield* printJson(after.state);
        yield* Console.log(
          [
            `${done} ${target.summary} of ${personKind.label(found)}. Webhooks and analytics follow in a moment.`,
            "",
            describeState(found, after),
          ].join("\n"),
        );
      }),
  ).pipe(Command.withDescription(description));
};

/** `voidhash-cli sandbox reset [--yes]` */
const sandboxResetCommand = Command.make(
  "reset",
  { project: projectOption, yes: yesOption },
  ({ project, yes }) =>
    Effect.gen(function* () {
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      yield* confirmChange({
        yes,
        message: `Delete every simulated purchase and subscription in ${projectKind(context.session).label(context.project)}, and the access they granted? Production, store sandbox and other test purchases, such as Stripe test mode's, stay.`,
      });
      yield* api.sandboxDeleteData(context.project.id);
      yield* Console.log(
        "Deleted every simulated purchase and subscription; testers start over with nothing bought.",
      );
    }),
).pipe(
  Command.withDescription(
    "Delete every simulated purchase in the project, to start testing over. Stripe and payment source test purchases stay. Asks first; --yes skips that.",
  ),
);

/** `voidhash-cli sandbox …` */
export const sandboxCommand = Command.make("sandbox").pipe(
  Command.withDescription(
    "Test your app's purchases without a store: see what a tester bought, simulate renewals, expiry and refunds, or start over. Debug builds in development mode make the purchases with the test publishable key; they are test purchases and never unlock production.",
  ),
  Command.withSubcommands([
    sandboxViewCommand,
    sandboxActionCommand("renew"),
    sandboxActionCommand("expire"),
    sandboxActionCommand("grace_period"),
    sandboxActionCommand("refund"),
    sandboxActionCommand("revoke"),
    sandboxResetCommand,
  ]),
);
