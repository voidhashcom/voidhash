import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Argument, Command, Flag } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { ExitCode, userError } from "../../utils/error-formatter";
import { signedInSession } from "../context";
import { confirmByTypingName, requireItem, requireText } from "../input";
import { outputModeOf, printIds, printItem, printJson, printTable } from "../output";
import { outputOptions, yesOption } from "../shared-options";
import { logoOptions, organizationKind, readLogo } from "./workspace";

const organizationArgument = Argument.String("org").pipe(
  Argument.withDescription("The organization's slug, name or id"),
  Argument.optional,
);

/** `voidhash-cli org list` */
const orgListCommand = Command.make("list", { ...outputOptions }, ({ json, quiet }) =>
  Effect.gen(function* () {
    const mode = yield* outputModeOf({ json, quiet });
    const api = yield* ApiClient;
    const organizations = yield* readAll((query) => api.organizationsList(query));
    if (mode === "json") return yield* printJson(organizations);
    if (mode === "quiet") return yield* printIds(organizations);
    const session = yield* signedInSession;
    const projectsIn = (organizationId: string) =>
      session.projects.filter((project) => project.organizationId === organizationId);
    yield* printTable(
      [
        { header: "NAME", cell: (organization) => organization.name },
        { header: "SLUG", cell: (organization) => organization.slug },
        {
          header: "PROJECTS",
          cell: (organization) =>
            projectsIn(organization.id)
              .map(({ slug }) => slug)
              .join(", ") || "-",
        },
        { header: "ID", cell: (organization) => organization.id },
      ],
      organizations,
      "You belong to no organization yet. Create one with 'voidhash-cli org create'.",
    );
  }),
).pipe(Command.withDescription("List the organizations you belong to and their projects."));

/** `voidhash-cli org create [name]` */
const orgCreateCommand = Command.make(
  "create",
  {
    name: Argument.String("name").pipe(
      Argument.withDescription("The organization's name, such as your company's"),
      Argument.optional,
    ),
    ...outputOptions,
  },
  ({ json, name, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const organizationName = yield* requireText(name, {
        flag: "the name",
        message: "Organization name",
        usage: "voidhash-cli org create <name>",
      });
      const created = yield* api.organizationsCreate({ name: organizationName });
      yield* printItem(
        mode,
        created,
        [
          `Created ${organizationKind.label(created)}; you are its owner.`,
          "Next:",
          `  Create a project in it: 'voidhash-cli project create --org ${created.slug}'`,
          `  Add your team: 'voidhash-cli member invite <email> --org ${created.slug}'`,
        ].join("\n"),
      );
    }),
).pipe(Command.withDescription("Create an organization, with you as its owner."));

/** `voidhash-cli org edit [org] [--name] [--logo <file> | --remove-logo]` */
const orgEditCommand = Command.make(
  "edit",
  {
    org: organizationArgument,
    name: Flag.String("name").pipe(Flag.withDescription("Its new name"), Flag.optional),
    ...logoOptions,
    ...outputOptions,
  },
  ({ json, logo, name, org, quiet, removeLogo }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      if (Option.isSome(logo) && removeLogo) {
        return yield* Effect.fail(
          userError("--logo and --remove-logo cannot be combined.", { exitCode: ExitCode.usage }),
        );
      }
      if (Option.isNone(name) && Option.isNone(logo) && !removeLogo) {
        return yield* Effect.fail(
          userError("Nothing to change.", {
            hint: "Pass --name, --logo <file> or --remove-logo.",
            exitCode: ExitCode.usage,
          }),
        );
      }
      const api = yield* ApiClient;
      const session = yield* signedInSession;
      const found = yield* requireItem(
        organizationKind,
        session.organizations,
        org,
        "voidhash-cli org edit <org> --name <name>",
      );
      // Read the image first, so a bad file changes nothing.
      const image = Option.isSome(logo) ? Option.some(yield* readLogo(logo.value)) : Option.none();
      const renamed = Option.isSome(name)
        ? yield* api.organizationsUpdate(found.id, { name: name.value })
        : yield* api.organizationsGet(found.id);
      const updated = Option.isSome(image)
        ? yield* api.organizationsSetAvatar(found.id, image.value)
        : removeLogo
          ? yield* Effect.as(api.organizationsRemoveAvatar(found.id), { ...renamed, logoUrl: null })
          : renamed;
      const changes = [
        ...(Option.isSome(name) && name.value !== found.name
          ? [`renamed it from ${found.name}`]
          : []),
        ...(Option.isSome(image) ? ["set its logo"] : []),
        ...(removeLogo ? ["removed its logo"] : []),
      ];
      yield* printItem(
        mode,
        updated,
        Arr.match(changes, {
          onEmpty: () => "Nothing changed.",
          onNonEmpty: (some) =>
            `Updated ${organizationKind.label(updated)}: ${some.join(", ")}. Its slug stays ${updated.slug}.`,
        }),
      );
    }),
).pipe(
  Command.withDescription("Rename an organization or change its logo. Its slug never changes."),
);

/** `voidhash-cli org delete [org] [--yes]` */
const orgDeleteCommand = Command.make(
  "delete",
  { org: organizationArgument, yes: yesOption, ...outputOptions },
  ({ json, org, quiet, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const session = yield* signedInSession;
      const found = yield* requireItem(
        organizationKind,
        session.organizations,
        org,
        "voidhash-cli org delete <org> --yes",
      );
      const projects = session.projects.filter((project) => project.organizationId === found.id);
      yield* confirmByTypingName({
        yes,
        message: `Delete ${organizationKind.label(found)} for good? ${Arr.match(projects, {
          onEmpty: () => "It has no projects you can see.",
          onNonEmpty: (some) =>
            `Its projects ${some.map(({ slug }) => slug).join(", ")} and everything in them (keys, catalog, people, purchases, analytics) are deleted, and apps using their keys stop working.`,
        })} Every member loses access.`,
        name: found.name,
      });
      yield* api.organizationsDelete(found.id);
      yield* printItem(mode, found, `Deleted ${organizationKind.label(found)}.`);
    }),
).pipe(
  Command.withDescription(
    "Delete an organization with its projects and all their data. Asks you to type its name; --yes skips that.",
  ),
);

/** `voidhash-cli org …` */
export const orgCommand = Command.make("org").pipe(
  Command.withAlias("orgs"),
  Command.withDescription(
    "The organizations that own your projects: list, create, rename and delete them.",
  ),
  Command.withSubcommands([orgListCommand, orgCreateCommand, orgEditCommand, orgDeleteCommand]),
);
