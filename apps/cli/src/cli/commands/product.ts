import type {
  PerkJsonEncoding,
  ProductJsonEncoding,
  ProductType,
} from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Argument, Command, Flag, Prompt } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { apiError, apiErrorCode, ExitCode, userError } from "../../utils/error-formatter";
import { dashboardUrl, projectKind, readCliConfig, resolveProject } from "../context";
import {
  confirmChange,
  findItem,
  isInteractive,
  missingInput,
  requireChoice,
  requireItem,
  requireText,
} from "../input";
import { formatFields, outputModeOf, printIds, printItem, printJson, printTable } from "../output";
import { dryRunOption, outputOptions, projectOption, yesOption } from "../shared-options";
import {
  BILLING_PERIODS,
  listStoreProducts,
  PRODUCT_TYPES,
  perkKind,
  productKind,
  productTypeLabel,
  slugFrom,
  storeLabel,
} from "./catalog";
import { printable } from "../../utils/printable";

const productArgument = Argument.String("product").pipe(
  Argument.withDescription("The product's slug, name or id"),
  Argument.optional,
);

/** The slugs of `perks`, or "no perks". */
const perkSlugs = (perks: ReadonlyArray<PerkJsonEncoding>) =>
  Arr.match(perks, {
    onEmpty: () => "no perks",
    onNonEmpty: (some) => some.map(({ slug }) => slug).join(", "),
  });

const slugTakenHint = (slug: string) =>
  `Choose another --slug; 'voidhash-cli product view ${slug}' shows the product that has it.`;

/** `voidhash-cli product list [--type <type>]` */
const productListCommand = Command.make(
  "list",
  {
    project: projectOption,
    type: Flag.ChoiceWithValue("type", PRODUCT_TYPES).pipe(
      Flag.withDescription("Only products of this type"),
      Flag.optional,
    ),
    ...outputOptions,
  },
  ({ json, project, quiet, type }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const products = yield* readAll((query) =>
        api.productsList(projectId, { ...query, type: Option.getOrUndefined(type) }),
      );
      if (mode === "json") return yield* printJson(products);
      if (mode === "quiet") return yield* printIds(products);

      // Only people see what each product grants and where it is sold, so only they wait for it.
      const [rows, { storeProducts }] = yield* Effect.all(
        [
          Effect.forEach(
            products,
            (product) =>
              readAll((query) => api.productsListPerks(projectId, product.id, query)).pipe(
                Effect.map((perks) => ({ product, perks })),
              ),
            { concurrency: 8 },
          ),
          listStoreProducts(projectId),
        ],
        { concurrency: 2 },
      );
      const storesOf = (product: ProductJsonEncoding) =>
        Arr.dedupe(
          storeProducts
            .filter(({ mapping }) => mapping.productId === product.id && mapping.isActive)
            .map(({ provider }) => storeLabel(provider)),
        ).join(", ") || "-";
      yield* printTable(
        [
          { header: "NAME", cell: ({ product }) => product.name },
          { header: "SLUG", cell: ({ product }) => product.slug },
          { header: "TYPE", cell: ({ product }) => productTypeLabel(product) },
          { header: "PERKS", cell: ({ perks }) => perks.map(({ slug }) => slug).join(", ") || "-" },
          { header: "STORES", cell: ({ product }) => storesOf(product) },
          { header: "ID", cell: ({ product }) => product.id },
        ],
        rows,
        "No products yet. Create one with 'voidhash-cli product create'.",
      );
    }),
).pipe(
  Command.withDescription(
    "List the project's products with the perks they grant and the stores they are sold in.",
  ),
);

/** `voidhash-cli product view <product>` */
const productViewCommand = Command.make(
  "view",
  { product: productArgument, project: projectOption, ...outputOptions },
  ({ json, product, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const products = yield* readAll((query) => api.productsList(projectId, query));
      const found = yield* requireItem(
        productKind,
        products,
        product,
        "voidhash-cli product view <product>",
      );
      if (mode === "quiet") return yield* printIds([found]);
      const [perks, { storeProducts }] = yield* Effect.all(
        [
          readAll((query) => api.productsListPerks(projectId, found.id, query)),
          listStoreProducts(projectId, found.id),
        ],
        { concurrency: 2 },
      );
      if (mode === "json") {
        return yield* printJson({
          ...found,
          perks,
          storeProducts: storeProducts.map(({ mapping }) => mapping),
        });
      }
      const { web_url } = yield* readCliConfig;
      yield* Console.log(
        [
          productKind.label(found),
          formatFields([
            ["Type", productTypeLabel(found)],
            [
              "Perks",
              Arr.match(perks, {
                onEmpty: () =>
                  `none; choose some with 'voidhash-cli product perks set ${found.slug}'`,
                onNonEmpty: (granted) => granted.map(perkKind.label).join("\n"),
              }),
            ],
            [
              "Stores",
              Arr.match(storeProducts, {
                onEmpty: () =>
                  `none mapped; map its store products in the dashboard ('voidhash-cli open product ${found.slug}')`,
                onNonEmpty: (mapped) =>
                  mapped
                    .map(
                      ({ mapping, provider }) =>
                        `${storeLabel(provider)}: ${mapping.providerProductKey}${mapping.environment === "all" ? "" : ` [${mapping.environment}]`}${mapping.isActive ? "" : " (inactive)"}`,
                    )
                    .join("\n"),
              }),
            ],
            ["ID", found.id],
            ...Arr.fromOption(
              Option.map(
                dashboardUrl(web_url, context, `products/${found.id}`),
                (url) => ["Dashboard", url] as const,
              ),
            ),
          ]),
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Show a product: its type, the perks it grants and the store products it is sold as.",
  ),
);

const CREATE_USAGE =
  "voidhash-cli product create --name <name> --type <subscription|one-time|consumable> [--period <period>]";

/** `voidhash-cli product create [--name] [--slug] [--type] [--period] [--perk]…` */
const productCreateCommand = Command.make(
  "create",
  {
    project: projectOption,
    name: Flag.String("name").pipe(
      Flag.withDescription("What people see, such as Pro Monthly"),
      Flag.optional,
    ),
    slug: Flag.String("slug").pipe(
      Flag.withDescription("How your code and the API name it (default: made from the name)"),
      Flag.optional,
    ),
    type: Flag.ChoiceWithValue("type", PRODUCT_TYPES).pipe(
      Flag.withDescription(
        "subscription (renews), one-time (kept for good) or consumable (bought again and again)",
      ),
      Flag.optional,
    ),
    period: Flag.ChoiceWithValue("period", BILLING_PERIODS).pipe(
      Flag.withDescription("How often a subscription renews"),
      Flag.optional,
    ),
    perk: Flag.String("perk").pipe(
      Flag.withDescription("A perk buying it grants: its slug, name or id; repeat for each"),
      Flag.atLeast(0),
    ),
    ...outputOptions,
  },
  ({ json, name, period, perk, project, quiet, slug, type }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;

      const productName = yield* requireText(name, {
        flag: "--name",
        message: "Name, as people see it",
        usage: CREATE_USAGE,
      });
      const productSlug =
        Option.isSome(slug) || !(yield* isInteractive)
          ? Option.getOrElse(slug, () => slugFrom(productName))
          : yield* requireText(slug, {
              flag: "--slug",
              message: "Slug, as your code names it",
              usage: CREATE_USAGE,
              initial: slugFrom(productName),
            });
      const productType = yield* requireChoice<ProductType>(type, {
        flag: "--type",
        message: "What do people buy?",
        usage: CREATE_USAGE,
        choices: [
          { title: "A subscription, renewed until cancelled", value: "subscription" },
          { title: "A one-time purchase, kept for good", value: "one_time" },
          {
            title: "A consumable, bought again and again (such as coins)",
            value: "one_time_consumable",
          },
        ],
      });
      if (productType !== "subscription" && Option.isSome(period)) {
        return yield* Effect.fail(
          userError("--period applies only to subscriptions.", { exitCode: ExitCode.usage }),
        );
      }
      const billingPeriod =
        productType === "subscription"
          ? yield* requireChoice(period, {
              flag: "--period",
              message: "How often does it renew?",
              usage: CREATE_USAGE,
              choices: BILLING_PERIODS.map(([title, value]) => ({ title, value })),
            })
          : null;
      // Find the perks first, so a typo creates nothing.
      const perks = Arr.isReadonlyArrayEmpty(perk)
        ? []
        : yield* Effect.flatMap(
            readAll((query) => api.perksList(projectId, query)),
            (all) =>
              Effect.forEach(perk, (input) => findItem(perkKind, all, input), { concurrency: 1 }),
          );

      const created = yield* api
        .productsCreate(projectId, {
          name: productName,
          slug: productSlug,
          type: productType,
          billingPeriod,
        })
        .pipe(
          Effect.mapError((error) =>
            apiError(error, { product_slug_taken: slugTakenHint(productSlug) }),
          ),
        );
      yield* Effect.forEach(
        perks,
        (granted) => api.productsAddPerk(projectId, created.id, granted.id),
        { concurrency: 1, discard: true },
      );
      yield* printItem(
        mode,
        created,
        [
          `Created ${productKind.label(created)}: ${productTypeLabel(created)}, granting ${perkSlugs(perks)}.`,
          "Next:",
          ...(Arr.isReadonlyArrayEmpty(perks)
            ? [`  Choose the perks it grants: 'voidhash-cli product perks set ${created.slug}'`]
            : []),
          `  Map it to its store products in the dashboard: 'voidhash-cli open product ${created.slug}'`,
          "  Use it in your app after 'voidhash-cli types generate'.",
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Create a product: a subscription, a one-time purchase or a consumable. Asks for what is missing in a terminal.",
  ),
);

/** `voidhash-cli product edit <product> [--name] [--slug]` */
const productEditCommand = Command.make(
  "edit",
  {
    product: productArgument,
    project: projectOption,
    name: Flag.String("name").pipe(Flag.withDescription("Its new name"), Flag.optional),
    slug: Flag.String("slug").pipe(Flag.withDescription("Its new slug"), Flag.optional),
    ...outputOptions,
  },
  ({ json, name, product, project, quiet, slug }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const products = yield* readAll((query) => api.productsList(projectId, query));
      const found = yield* requireItem(
        productKind,
        products,
        product,
        "voidhash-cli product edit <product> --name <name>",
      );
      const asked =
        Option.isSome(name) || Option.isSome(slug)
          ? { name, slug }
          : yield* Effect.gen(function* () {
              if (!(yield* isInteractive)) {
                return yield* Effect.fail(
                  userError("Nothing to change.", {
                    hint: "Pass --name or --slug. A product's type and billing period cannot change.",
                    exitCode: ExitCode.usage,
                  }),
                );
              }
              return {
                name: Option.some(
                  yield* Prompt.run(Prompt.String({ message: "Name", default: found.name })),
                ),
                slug: Option.some(
                  yield* Prompt.run(Prompt.String({ message: "Slug", default: found.slug })),
                ),
              };
            });
      const newName = Option.filter(asked.name, (value) => value !== found.name);
      const newSlug = Option.filter(asked.slug, (value) => value !== found.slug);
      if (Option.isNone(newName) && Option.isNone(newSlug)) {
        return yield* printItem(mode, found, "Nothing changed.");
      }
      const updated = yield* api
        .productsUpdate(projectId, found.id, {
          name: Option.getOrUndefined(newName),
          slug: Option.getOrUndefined(newSlug),
        })
        .pipe(
          Effect.mapError((error) =>
            apiError(error, {
              product_slug_taken: slugTakenHint(Option.getOrElse(newSlug, () => found.slug)),
            }),
          ),
        );
      yield* printItem(
        mode,
        updated,
        [
          `Updated ${productKind.label(updated)}.`,
          ...(Option.isSome(newSlug)
            ? [
                `Code that names it ${found.slug} needs ${updated.slug} now; run 'voidhash-cli types generate' in your app.`,
              ]
            : []),
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Rename a product or change its slug. Its type and billing period cannot change.",
  ),
);

/** `voidhash-cli product delete <product> [--yes]` */
const productDeleteCommand = Command.make(
  "delete",
  { product: productArgument, project: projectOption, yes: yesOption, ...outputOptions },
  ({ json, product, project, quiet, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const products = yield* readAll((query) => api.productsList(projectId, query));
      const found = yield* requireItem(
        productKind,
        products,
        product,
        "voidhash-cli product delete <product> --yes",
      );
      yield* confirmChange({
        yes,
        message: `Delete ${productKind.label(found)} from ${projectKind(context.session).label(context.project)}? This cannot be undone.`,
      });
      yield* api.productsDelete(projectId, found.id).pipe(
        Effect.mapError((error) =>
          apiError(error, {
            product_in_use: `Remove its store products in the dashboard first: 'voidhash-cli open product ${found.slug}'.`,
          }),
        ),
      );
      yield* printItem(mode, found, `Deleted ${productKind.label(found)}.`);
    }),
).pipe(
  Command.withDescription(
    "Delete a product that no store product is mapped to. Asks first; --yes skips that.",
  ),
);

const PERKS_SET_USAGE = "voidhash-cli product perks set <product> <perk>…";

/** `voidhash-cli product perks set <product> [perk…] [--none] [--dry-run] [--yes]` */
const productPerksSetCommand = Command.make(
  "set",
  {
    product: productArgument,
    perks: Argument.String("perk").pipe(
      Argument.withDescription("Every perk the product should grant: its slug, name or id"),
      Argument.variadic(),
    ),
    none: Flag.Boolean("none").pipe(
      Flag.withDescription("Grant no perks at all"),
      Flag.withDefault(false),
    ),
    project: projectOption,
    yes: yesOption,
    dryRun: dryRunOption,
    ...outputOptions,
  },
  ({ dryRun, json, none, perks, product, project, quiet, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      if (none && Arr.isReadonlyArrayNonEmpty(perks)) {
        return yield* Effect.fail(
          userError("--none grants no perks, so it takes none.", { exitCode: ExitCode.usage }),
        );
      }
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const [products, allPerks] = yield* Effect.all(
        [
          readAll((query) => api.productsList(projectId, query)),
          readAll((query) => api.perksList(projectId, query)),
        ],
        { concurrency: 2 },
      );
      const found = yield* requireItem(productKind, products, product, PERKS_SET_USAGE);
      const current = yield* readAll((query) => api.productsListPerks(projectId, found.id, query));
      const isCurrent = (perk: PerkJsonEncoding) => current.some(({ id }) => id === perk.id);

      const wanted = Arr.dedupeWith(
        none
          ? []
          : Arr.isReadonlyArrayNonEmpty(perks)
            ? yield* Effect.forEach(perks, (input) => findItem(perkKind, allPerks, input), {
                concurrency: 1,
              })
            : yield* Effect.gen(function* () {
                if (!(yield* isInteractive)) {
                  return yield* Effect.fail(
                    missingInput("the perks", `${PERKS_SET_USAGE}, or --none to grant none`),
                  );
                }
                if (Arr.isReadonlyArrayEmpty(allPerks)) {
                  return yield* Effect.fail(
                    userError("There are no perks yet.", {
                      hint: "Create one with 'voidhash-cli perk create'.",
                      exitCode: ExitCode.notFound,
                    }),
                  );
                }
                return yield* Prompt.run(
                  Prompt.MultiSelect({
                    message: printable(`Which perks should ${found.name} grant?`),
                    choices: allPerks.map((perk) => ({
                      title: printable(perkKind.label(perk)),
                      value: perk,
                      selected: isCurrent(perk),
                    })),
                  }),
                );
              }),
        (a, b) => a.id === b.id,
      );
      const toAdd = wanted.filter((perk) => !isCurrent(perk));
      const toRemove = current.filter((perk) => !wanted.some(({ id }) => id === perk.id));
      const changes = [
        ...toAdd.map((perk) => `  + ${printable(perkKind.label(perk))}`),
        ...toRemove.map((perk) => `  - ${printable(perkKind.label(perk))}`),
      ];

      if (Arr.isReadonlyArrayEmpty(changes)) {
        if (mode === "json") return yield* printJson(current);
        if (mode === "quiet") return yield* printIds(current);
        return yield* Console.log(printable(`${found.name} already grants ${perkSlugs(current)}.`));
      }
      if (dryRun) {
        if (mode === "json") return yield* printJson({ add: toAdd, remove: toRemove });
        return yield* Console.log(
          [
            printable(`${found.name} would grant ${perkSlugs(wanted)}:`),
            ...changes,
            "Nothing changed (--dry-run).",
          ].join("\n"),
        );
      }
      if (Arr.isReadonlyArrayNonEmpty(toRemove)) {
        yield* confirmChange({
          yes,
          message: `${found.name} will stop granting ${perkSlugs(toRemove)}, and people who bought it lose ${toRemove.length === 1 ? "that perk unless something else grants it" : "those perks unless something else grants them"}. Continue?`,
        });
      }
      yield* Effect.forEach(toAdd, (perk) => api.productsAddPerk(projectId, found.id, perk.id), {
        concurrency: 1,
        discard: true,
      });
      yield* Effect.forEach(
        toRemove,
        (perk) =>
          api.productsRemovePerk(projectId, found.id, perk.id).pipe(
            // Someone removed it meanwhile: it is as asked.
            Effect.catchIf(
              (error) => Option.contains(apiErrorCode(error), "perk_not_granted"),
              () => Effect.void,
            ),
          ),
        { concurrency: 1, discard: true },
      );
      if (mode === "json") return yield* printJson(wanted);
      if (mode === "quiet") return yield* printIds(wanted);
      yield* Console.log(
        [printable(`${found.name} now grants ${perkSlugs(wanted)}:`), ...changes].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Make a product grant exactly these perks, adding and removing what differs. Without perks it asks in a terminal. Running it again finishes a change that failed halfway.",
  ),
);

const productPerksCommand = Command.make("perks").pipe(
  Command.withDescription("Choose the perks a product grants."),
  Command.withSubcommands([productPerksSetCommand]),
);

/** `voidhash-cli product …` */
export const productCommand = Command.make("product").pipe(
  Command.withAlias("products"),
  Command.withDescription(
    "The products people buy: list, view, create, edit and delete them, and choose the perks they grant.",
  ),
  Command.withSubcommands([
    productListCommand,
    productViewCommand,
    productCreateCommand,
    productEditCommand,
    productDeleteCommand,
    productPerksCommand,
  ]),
);
