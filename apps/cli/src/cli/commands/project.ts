import type { SessionJsonEncoding } from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Argument, Command, Flag } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { ExitCode, userError } from "../../utils/error-formatter";
import { projectKind, resolveProject, signedInSession, writeCliConfig } from "../context";
import { confirmByTypingName, findItem, requireText } from "../input";
import { outputModeOf, printIds, printItem, printJson, printTable } from "../output";
import { outputOptions, yesOption } from "../shared-options";
import {
  logoOptions,
  organizationKind,
  organizationOption,
  readLogo,
  resolveOrganization,
} from "./workspace";

const projectArgument = Argument.String("project").pipe(
  Argument.withDescription(
    "The project's slug, organization/slug, name or id (default: this directory's project, then your default project)",
  ),
  Argument.optional,
);

/** The project `input` names, or the one commands act on here. */
const projectNamed = (input: Option.Option<string>) =>
  Effect.gen(function* () {
    if (Option.isNone(input)) return (yield* resolveProject(Option.none())).project;
    const session: SessionJsonEncoding = yield* signedInSession;
    return yield* findItem(projectKind(session), session.projects, input.value);
  });

/** `voidhash-cli project list [--org]` */
const projectListCommand = Command.make(
  "list",
  { org: organizationOption, ...outputOptions },
  ({ json, org, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const organization = yield* resolveOrganization(org);
      const projects = yield* readAll((query) => api.projectsList(organization.id, query));
      if (mode === "json") return yield* printJson(projects);
      if (mode === "quiet") return yield* printIds(projects);
      yield* printTable(
        [
          { header: "NAME", cell: (project) => project.name },
          { header: "SLUG", cell: (project) => `${organization.slug}/${project.slug}` },
          { header: "ID", cell: (project) => project.id },
        ],
        projects,
        `${organizationKind.label(organization)} has no projects yet. Create one with 'voidhash-cli project create --org ${organization.slug}'.`,
      );
    }),
).pipe(Command.withDescription("List the projects of an organization."));

/** `voidhash-cli project create [name] [--org] [--switch]` */
const projectCreateCommand = Command.make(
  "create",
  {
    name: Argument.String("name").pipe(
      Argument.withDescription("The project's name, such as your app's"),
      Argument.optional,
    ),
    org: organizationOption,
    switch: Flag.Boolean("switch").pipe(
      Flag.withDescription("Make it your default project, as 'voidhash-cli switch' does"),
      Flag.withDefault(false),
    ),
    ...outputOptions,
  },
  ({ json, name, org, quiet, switch: makeDefault }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const organization = yield* resolveOrganization(org);
      const projectName = yield* requireText(name, {
        flag: "the name",
        message: "Project name",
        usage: "voidhash-cli project create <name> [--org <org>]",
      });
      const created = yield* api.projectsCreate(organization.id, { name: projectName });
      if (makeDefault) yield* writeCliConfig({ default_project: created.id });
      if (mode !== "human") return yield* printItem(mode, created, "");

      // Apps need the publishable keys, so people see them right away.
      const publishable = yield* api.apiKeysList(created.id, { type: "publishable" }).pipe(
        Effect.map((page) => page.data.filter((key) => key.rawKey !== null)),
        Effect.orElseSucceed(() => []),
      );
      const publishableOf = (environment: "production" | "test") =>
        Arr.findFirst(publishable, (key) => key.environment === environment);
      const path = `${organization.slug}/${created.slug}`;
      yield* printItem(
        mode,
        created,
        [
          `Created ${created.name} (${path}), ${created.id}.`,
          ...Arr.fromOption(
            Option.map(
              publishableOf("production"),
              (key) => `Publishable key: ${key.rawKey ?? ""}`,
            ),
          ),
          ...Arr.fromOption(
            Option.map(
              publishableOf("test"),
              (key) =>
                `Test publishable key, for debug, staging and test builds: ${key.rawKey ?? ""}`,
            ),
          ),
          "Next:",
          ...(makeDefault
            ? [`  It is your default project now.`]
            : [`  Make it your default: 'voidhash-cli switch ${path}'`]),
          "  Set up your app with it: 'voidhash-cli init'",
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Create a project, with its production and test publishable keys, in an organization. --switch makes it your default.",
  ),
);

/** `voidhash-cli project edit [project] [--name] [--logo <file> | --remove-logo]` */
const projectEditCommand = Command.make(
  "edit",
  {
    project: projectArgument,
    name: Flag.String("name").pipe(Flag.withDescription("Its new name"), Flag.optional),
    ...logoOptions,
    ...outputOptions,
  },
  ({ json, logo, name, project, quiet, removeLogo }) =>
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
      const found = yield* projectNamed(project);
      const image = Option.isSome(logo) ? Option.some(yield* readLogo(logo.value)) : Option.none();
      const renamed = Option.isSome(name)
        ? yield* api.projectsUpdate(found.id, { name: name.value })
        : yield* api.projectsGet(found.id);
      const updated = Option.isSome(image)
        ? yield* api.projectsSetAvatar(found.id, image.value)
        : removeLogo
          ? yield* Effect.as(api.projectsRemoveAvatar(found.id), { ...renamed, logoUrl: null })
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
            `Updated ${updated.name}: ${some.join(", ")}. Its slug stays ${updated.slug}, so apps and links keep working.`,
        }),
      );
    }),
).pipe(Command.withDescription("Rename a project or change its logo. Its slug never changes."));

/** `voidhash-cli project delete [project] [--yes]` */
const projectDeleteCommand = Command.make(
  "delete",
  { project: projectArgument, yes: yesOption, ...outputOptions },
  ({ json, project, quiet, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const session = yield* signedInSession;
      const found = yield* projectNamed(project);
      yield* confirmByTypingName({
        yes,
        message: `Delete ${projectKind(session).label(found)} for good? Its keys, catalog, people, purchases and analytics are deleted, and apps using its keys stop working.`,
        name: found.name,
      });
      yield* api.projectsDelete(found.id);
      yield* printItem(mode, found, `Deleted ${projectKind(session).label(found)}.`);
    }),
).pipe(
  Command.withDescription(
    "Delete a project and everything in it. Asks you to type its name; --yes skips that.",
  ),
);

/** `voidhash-cli project …` */
export const projectCommand = Command.make("project").pipe(
  Command.withAlias("projects"),
  Command.withDescription("Your projects: list, create, rename and delete them."),
  Command.withSubcommands([
    projectListCommand,
    projectCreateCommand,
    projectEditCommand,
    projectDeleteCommand,
  ]),
);
