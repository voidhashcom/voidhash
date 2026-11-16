/**
 * Who the CLI acts as and which project a command acts on.
 *
 * A project-scoped command acts on, in this order:
 *
 * 1. the project `--project` names (an id, a slug, `organization/slug` or a name);
 * 2. the project of the current directory: the one its `voidhash.config.ts`
 *    names, else the one `voidhash-cli link` bound it, or the nearest directory
 *    above it, to;
 * 3. the default project `voidhash-cli switch` chose;
 * 4. the only project the credential can use (a project secret key has one).
 *
 * Otherwise the CLI asks on a terminal, and fails with the list off one.
 *
 * Links and the default live in the CLI config (`~/.voidhash`), under the
 * active profile, never in the repository: they are personal (teammates may
 * work in their own projects), and a project id is only meaningful to the API
 * server and account the profile signs in to. `voidhash.config.ts` stays the
 * committed binding of an app that uses the SDK.
 */
import type {
  SessionJsonEncoding,
  SessionOrganizationJsonEncoding,
  SessionProjectJsonEncoding,
} from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";

import { FailedToStoreCredentialError } from "../domain/errors/auth";
import type { ResolvedCliConfig } from "../domain/schema/cli-config";
import type { VoidhashConfig } from "../domain/schema/voidhash-config";
import { Auth, sessionHolder } from "../domain/services/auth";
import { CliConfig } from "../domain/services/cli-config";
import { apiOrigin, Credentials } from "../domain/services/credentials";
import { SourceCode } from "../domain/services/source-code";
import { apiError, ExitCode, isApiFailure, userError } from "../utils/error-formatter";
import { chooseItem, findItem, isInteractive, type ItemKind } from "./input";

/**
 * The session of the stored key, or a failure that says on which server, and
 * how, to sign in. `VOIDHASH_API_KEY` wins over any sign-in, so when the
 * server refuses it, signing in cannot help.
 */
export const signedInSession = Effect.fn("signedInSession")(function* () {
  const auth = yield* Auth;
  const { environmentKey } = yield* Credentials;
  return yield* auth.getSignedInSession.pipe(
    Effect.catchTags({
      NoSignedInUserError: () =>
        Effect.flatMap(readCliConfig, ({ api_url }) => {
          const origin = Option.getOrElse(apiOrigin(api_url), () => api_url);
          return Effect.fail(
            Option.isSome(environmentKey)
              ? userError(`The server on ${origin} refused the key in VOIDHASH_API_KEY.`, {
                  hint: "Check that the key is current and belongs to this server, or unset VOIDHASH_API_KEY to use your sign-in.",
                  exitCode: ExitCode.unauthenticated,
                })
              : userError(`You are not signed in on ${origin}.`, {
                  hint: "Run 'voidhash-cli auth login' first.",
                  exitCode: ExitCode.unauthenticated,
                }),
          );
        }),
      FailedToGetSessionError: ({ cause }) =>
        Effect.fail(
          isApiFailure(cause)
            ? apiError(cause)
            : cause instanceof FailedToStoreCredentialError
              ? userError(`${cause.message}.`)
              : userError("Could not read your Voidhash session.", {
                  hint: "Check your connection, or sign in again with 'voidhash-cli auth login'.",
                }),
        ),
    }),
  );
})();

/** The organization `project` belongs to, when the session lists it (a secret key's may not). */
export const organizationOf = (session: SessionJsonEncoding, project: SessionProjectJsonEncoding) =>
  Arr.findFirst(session.organizations, ({ id }) => id === project.organizationId);

/** How projects read in messages and prompts, and the identifiers they answer to. */
export const projectKind = (session: SessionJsonEncoding): ItemKind<SessionProjectJsonEncoding> => {
  const path = (project: SessionProjectJsonEncoding) =>
    `${Option.match(organizationOf(session, project), {
      onNone: () => project.organizationId,
      onSome: ({ slug }) => slug,
    })}/${project.slug}`;
  return {
    noun: "project",
    label: (project) => `${project.name} (${path(project)})`,
    listCommand: "voidhash-cli whoami",
    keys: (project) => [project.slug, path(project)],
    names: (project) => [project.name],
  };
};

/** The organization and project `config` names, among those `session` can use. */
export const projectNamedBy = (config: VoidhashConfig, session: SessionJsonEncoding) => {
  const organization = session.organizations.find((candidate) => candidate.slug === config.team);
  const project = session.projects.find(
    (candidate) =>
      candidate.organizationId === organization?.id && candidate.slug === config.project,
  );
  return organization === undefined || project === undefined
    ? Effect.fail(
        userError(
          `voidhash.config names the project ${config.team}/${config.project}, which ${sessionHolder(session)} cannot reach.`,
          {
            hint: "Sign in with the account that can ('voidhash-cli auth login'), or run 'voidhash-cli init' again.",
            exitCode: ExitCode.notFound,
          },
        ),
      )
    : Effect.succeed({ organization, project });
};

/** The `voidhash.config.ts` of the current directory, when it has one. */
export const directoryConfig = Effect.fn("directoryConfig")(function* () {
  return yield* (yield* SourceCode).loadVoidhashConfig().pipe(
    Effect.map(Option.some),
    Effect.catchTags({
      VoidhashConfigNotFoundError: () => Effect.succeedNone,
      InvalidVoidhashConfigError: (error) => Effect.fail(userError(error.message)),
      FailedToLoadVoidhashConfigError: (error) => Effect.fail(userError(error.message)),
    }),
  );
})();

/** The CLI config of the active profile. */
export const readCliConfig = Effect.fn("readCliConfig")(function* () {
  return yield* (yield* CliConfig).readConfig().pipe(
    Effect.mapError(() =>
      userError("Could not read the CLI config, ~/.voidhash.", {
        hint: "Fix or remove the file, then sign in again with 'voidhash-cli auth login'.",
      }),
    ),
  );
})();

/** Writes `changes` to the CLI config of the active profile. */
export const writeCliConfig = (changes: Partial<ResolvedCliConfig>) =>
  Effect.gen(function* () {
    yield* (yield* CliConfig)
      .writeToConfig(changes)
      .pipe(
        Effect.mapError((error) =>
          userError(`Could not write the CLI config, ~/.voidhash: ${error.message}`),
        ),
      );
  });

/**
 * The nearest of the linked directories that `directory` is, or is inside,
 * with the project it is linked to.
 */
export const linkFor = (
  links: Readonly<Record<string, string>>,
  directory: string,
  separator: string,
) =>
  Arr.reduce(
    R.toEntries(links),
    Option.none<{ readonly directory: string; readonly projectId: string }>(),
    (nearest, [linked, projectId]) => {
      const contains =
        directory === linked ||
        directory.startsWith(linked.endsWith(separator) ? linked : `${linked}${separator}`);
      const isNearer = Option.match(nearest, {
        onNone: () => true,
        onSome: (current) => linked.length > current.directory.length,
      });
      return contains && isNearer ? Option.some({ directory: linked, projectId }) : nearest;
    },
  );

/** Where the project a command acts on came from. */
export type ProjectSource =
  | { readonly kind: "flag" }
  | { readonly kind: "config" }
  | { readonly kind: "link"; readonly directory: string }
  | { readonly kind: "default" }
  | { readonly kind: "only" }
  | { readonly kind: "chosen" };

/** The project a command acts on, with the session that can use it. */
export interface ProjectContext {
  readonly session: SessionJsonEncoding;
  readonly project: SessionProjectJsonEncoding;
  readonly organization: Option.Option<SessionOrganizationJsonEncoding>;
  readonly source: ProjectSource;
}

/** How a {@link ProjectSource} reads after the project: "linked to /work/app". */
export const describeSource = (source: ProjectSource) =>
  Match.value(source).pipe(
    Match.discriminatorsExhaustive("kind")({
      flag: () => "named by --project",
      config: () => "named by voidhash.config.ts here",
      link: ({ directory }) => `linked to ${directory}`,
      default: () => "your default project",
      only: () => "the only project you can use",
      chosen: () => "chosen just now",
    }),
  );

/**
 * The project a link or the default stores, among those `session` can use.
 * `stored` says where the id came from: "Your default project is".
 */
const storedProject = (
  session: SessionJsonEncoding,
  projectId: string,
  stale: { readonly stored: string; readonly hint: string },
) =>
  Effect.fromOption(Arr.findFirst(session.projects, ({ id }) => id === projectId)).pipe(
    Effect.mapError(() =>
      userError(`${stale.stored} ${projectId}, which ${sessionHolder(session)} cannot use.`, {
        hint: stale.hint,
        exitCode: ExitCode.notFound,
      }),
    ),
  );

/**
 * The project a project-scoped command acts on, decided in the order this
 * module describes, from `flag`, the `--project` the command was given.
 */
export const resolveProject = Effect.fn("resolveProject")(function* (flag: Option.Option<string>) {
  const session = yield* signedInSession;
  const kind = projectKind(session);
  const context = (project: SessionProjectJsonEncoding, source: ProjectSource): ProjectContext => ({
    session,
    project,
    organization: organizationOf(session, project),
    source,
  });

  if (Option.isSome(flag)) {
    return context(yield* findItem(kind, session.projects, flag.value), { kind: "flag" });
  }

  const config = yield* directoryConfig;
  if (Option.isSome(config)) {
    return context((yield* projectNamedBy(config.value, session)).project, { kind: "config" });
  }

  const path = yield* Path.Path;
  const cliConfig = yield* readCliConfig;
  const link = linkFor(cliConfig.links ?? {}, path.resolve("."), path.sep);
  if (Option.isSome(link)) {
    const project = yield* storedProject(session, link.value.projectId, {
      stored: `${link.value.directory} is linked to`,
      hint: "Link it to another with 'voidhash-cli link', or remove the link with 'voidhash-cli unlink'.",
    });
    return context(project, { kind: "link", directory: link.value.directory });
  }

  if (P.isString(cliConfig.default_project)) {
    const project = yield* storedProject(session, cliConfig.default_project, {
      stored: "Your default project is",
      hint: "Choose another with 'voidhash-cli switch'.",
    });
    return context(project, { kind: "default" });
  }

  const only = session.projects.length === 1 ? Arr.head(session.projects) : Option.none();
  if (Option.isSome(only)) return context(only.value, { kind: "only" });

  if (Arr.isReadonlyArrayEmpty(session.projects)) {
    return yield* Effect.fail(
      userError(`${sessionHolder(session)} cannot use any project.`, {
        hint: "Create one in the dashboard, or sign in with another account ('voidhash-cli auth login').",
        exitCode: ExitCode.notFound,
      }),
    );
  }
  if (!(yield* isInteractive)) {
    return yield* Effect.fail(
      userError(
        [
          `Which project? ${sessionHolder(session)} can use ${session.projects.length}:`,
          ...session.projects.map((project) => `  ${kind.label(project)}  ${project.id}`),
        ].join("\n"),
        {
          hint: "Pass --project <project>, link this directory with 'voidhash-cli link <project>', or choose a default with 'voidhash-cli switch <project>'.",
          exitCode: ExitCode.usage,
        },
      ),
    );
  }
  const chosen = yield* chooseItem(kind, session.projects);
  yield* Console.error(
    `'voidhash-cli link' makes a project this directory's; 'voidhash-cli switch' makes it your default.`,
  );
  return context(chosen, { kind: "chosen" });
});

/** The dashboard address of `page` in the project, such as `products/prod_123`. */
export const dashboardUrl = (
  webUrl: string,
  context: Pick<ProjectContext, "organization" | "project">,
  page = "",
) =>
  Option.map(context.organization, ({ slug }) =>
    new URL(
      `/studio/${slug}/${context.project.slug}${page === "" ? "" : `/${page}`}`,
      webUrl,
    ).toString(),
  );
