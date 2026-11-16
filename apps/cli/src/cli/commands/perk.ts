import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Argument, Command, Flag, Prompt } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { apiError, ExitCode, userError } from "../../utils/error-formatter";
import { projectKind, resolveProject } from "../context";
import { confirmChange, findItem, isInteractive, requireItem, requireText } from "../input";
import { outputModeOf, printIds, printItem, printJson, printTable } from "../output";
import { outputOptions, projectOption, yesOption } from "../shared-options";
import { perkKind, productKind, slugFrom } from "./catalog";

const perkArgument = Argument.String("perk").pipe(
  Argument.withDescription("The perk's slug, name or id"),
  Argument.optional,
);

const slugTakenHint = (slug: string) =>
  `Choose another --slug; 'voidhash-cli perk list' shows the perk ${slug} belongs to.`;

/** `voidhash-cli perk list` */
const perkListCommand = Command.make(
  "list",
  { project: projectOption, ...outputOptions },
  ({ json, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const perks = yield* readAll((query) => api.perksList(projectId, query));
      if (mode === "json") return yield* printJson(perks);
      if (mode === "quiet") return yield* printIds(perks);

      // Which products grant each perk, for people only: one listing per product.
      const products = yield* readAll((query) => api.productsList(projectId, query));
      const grants = yield* Effect.forEach(
        products,
        (product) =>
          readAll((query) => api.productsListPerks(projectId, product.id, query)).pipe(
            Effect.map((granted) => ({ product, granted })),
          ),
        { concurrency: 8 },
      );
      const grantedBy = (perkId: string) =>
        grants
          .filter(({ granted }) => granted.some(({ id }) => id === perkId))
          .map(({ product }) => product.slug)
          .join(", ") || "-";
      yield* printTable(
        [
          { header: "NAME", cell: (perk) => perk.name },
          { header: "SLUG", cell: (perk) => perk.slug },
          { header: "GRANTED BY", cell: (perk) => grantedBy(perk.id) },
          { header: "ID", cell: (perk) => perk.id },
        ],
        perks,
        "No perks yet. Create one with 'voidhash-cli perk create'.",
      );
    }),
).pipe(Command.withDescription("List the project's perks and the products that grant each."));

const CREATE_USAGE = "voidhash-cli perk create --name <name> [--product <product>]…";

/** `voidhash-cli perk create [--name] [--slug] [--product]…` */
const perkCreateCommand = Command.make(
  "create",
  {
    project: projectOption,
    name: Flag.String("name").pipe(
      Flag.withDescription("What people see, such as Premium"),
      Flag.optional,
    ),
    slug: Flag.String("slug").pipe(
      Flag.withDescription(
        "How your code checks for it, such as premium (default: made from the name)",
      ),
      Flag.optional,
    ),
    product: Flag.String("product").pipe(
      Flag.withDescription("A product that grants it: its slug, name or id; repeat for each"),
      Flag.atLeast(0),
    ),
    ...outputOptions,
  },
  ({ json, name, product, project, quiet, slug }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;

      const perkName = yield* requireText(name, {
        flag: "--name",
        message: "Name, as people see it",
        usage: CREATE_USAGE,
      });
      const perkSlug =
        Option.isSome(slug) || !(yield* isInteractive)
          ? Option.getOrElse(slug, () => slugFrom(perkName))
          : yield* requireText(slug, {
              flag: "--slug",
              message: "Slug, as your code checks for it",
              usage: CREATE_USAGE,
              initial: slugFrom(perkName),
            });
      // Find the products first, so a typo creates nothing.
      const granting = Arr.isReadonlyArrayEmpty(product)
        ? []
        : yield* Effect.flatMap(
            readAll((query) => api.productsList(projectId, query)),
            (all) =>
              Effect.forEach(product, (input) => findItem(productKind, all, input), {
                concurrency: 1,
              }),
          );

      const created = yield* api
        .perksCreate(projectId, { name: perkName, slug: perkSlug })
        .pipe(
          Effect.mapError((error) => apiError(error, { perk_slug_taken: slugTakenHint(perkSlug) })),
        );
      yield* Effect.forEach(
        granting,
        (granter) => api.productsAddPerk(projectId, granter.id, created.id),
        { concurrency: 1, discard: true },
      );
      yield* printItem(
        mode,
        created,
        [
          `Created ${perkKind.label(created)}${Arr.match(granting, {
            onEmpty: () => "",
            onNonEmpty: (some) => `, granted by ${some.map(({ slug }) => slug).join(", ")}`,
          })}.`,
          "Next:",
          ...(Arr.isReadonlyArrayEmpty(granting)
            ? ["  Choose the products that grant it: 'voidhash-cli product perks set <product>'"]
            : []),
          `  Check for ${created.slug} in your app after 'voidhash-cli types generate'.`,
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Create a perk, the access your app checks for, and optionally the products that grant it.",
  ),
);

/** `voidhash-cli perk edit <perk> [--name] [--slug]` */
const perkEditCommand = Command.make(
  "edit",
  {
    perk: perkArgument,
    project: projectOption,
    name: Flag.String("name").pipe(Flag.withDescription("Its new name"), Flag.optional),
    slug: Flag.String("slug").pipe(Flag.withDescription("Its new slug"), Flag.optional),
    ...outputOptions,
  },
  ({ json, name, perk, project, quiet, slug }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const perks = yield* readAll((query) => api.perksList(projectId, query));
      const found = yield* requireItem(
        perkKind,
        perks,
        perk,
        "voidhash-cli perk edit <perk> --name <name>",
      );
      const asked =
        Option.isSome(name) || Option.isSome(slug)
          ? { name, slug }
          : yield* Effect.gen(function* () {
              if (!(yield* isInteractive)) {
                return yield* Effect.fail(
                  userError("Nothing to change.", {
                    hint: "Pass --name or --slug.",
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
        .perksUpdate(projectId, found.id, {
          name: Option.getOrUndefined(newName),
          slug: Option.getOrUndefined(newSlug),
        })
        .pipe(
          Effect.mapError((error) =>
            apiError(error, {
              perk_slug_taken: slugTakenHint(Option.getOrElse(newSlug, () => found.slug)),
            }),
          ),
        );
      yield* printItem(
        mode,
        updated,
        [
          `Updated ${perkKind.label(updated)}.`,
          ...(Option.isSome(newSlug)
            ? [
                `Apps that check for ${found.slug} must check for ${updated.slug} now; run 'voidhash-cli types generate' in your app.`,
              ]
            : []),
        ].join("\n"),
      );
    }),
).pipe(Command.withDescription("Rename a perk or change the slug your app checks for."));

/** `voidhash-cli perk delete <perk> [--yes]` */
const perkDeleteCommand = Command.make(
  "delete",
  { perk: perkArgument, project: projectOption, yes: yesOption, ...outputOptions },
  ({ json, perk, project, quiet, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const perks = yield* readAll((query) => api.perksList(projectId, query));
      const found = yield* requireItem(
        perkKind,
        perks,
        perk,
        "voidhash-cli perk delete <perk> --yes",
      );
      yield* confirmChange({
        yes,
        message: `Delete ${perkKind.label(found)} from ${projectKind(context.session).label(context.project)}? Every product stops granting it, and everyone who has it loses it.`,
      });
      yield* api.perksDelete(projectId, found.id);
      yield* printItem(mode, found, `Deleted ${perkKind.label(found)}.`);
    }),
).pipe(
  Command.withDescription(
    "Delete a perk: every product stops granting it and everyone loses it. Asks first; --yes skips that.",
  ),
);

/** `voidhash-cli perk …` */
export const perkCommand = Command.make("perk").pipe(
  Command.withAlias("perks"),
  Command.withDescription(
    "The perks your app checks for, which products grant: list, create, edit and delete them.",
  ),
  Command.withSubcommands([perkListCommand, perkCreateCommand, perkEditCommand, perkDeleteCommand]),
);
