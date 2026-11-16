import type {
  PaywallComponentJsonEncoding,
  PublishedComponentInstallJsonEncoding,
  PublishedComponentJsonEncoding,
  SessionProjectJsonEncoding,
} from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Command } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { componentApiUserError } from "../../utils/components/component-api";
import { resolveProject } from "../context";
import { projectOption } from "../shared-options";

/** Columns padded to their widest cell. */
const table = (rows: ReadonlyArray<ReadonlyArray<string>>): string => {
  const widths = rows.reduce<Array<number>>(
    (max, row) => row.map((cell, column) => Math.max(max[column] ?? 0, cell.length)),
    [],
  );
  return rows
    .map((row) =>
      row
        .map((cell, column) => cell.padEnd(widths[column] ?? 0))
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
};

/** A version's warning codes, or `-` when the server checked everything. */
const warningsCell = (warnings: ReadonlyArray<string>) =>
  Arr.match(warnings, { onEmpty: () => "-", onNonEmpty: (codes) => codes.join(", ") });

const projectRows = (components: ReadonlyArray<PaywallComponentJsonEncoding>) => [
  ["SLUG", "TITLE", "LATEST", "READY", "HASH", "WARNINGS"],
  ...components.map(({ latestReadyVersion, latestVersion, slug, title }) => [
    slug,
    title,
    latestVersion === null
      ? "-"
      : `v${latestVersion.version} ${latestVersion.status}${latestVersion.conformance?.hasPassed === false ? " (failed checks)" : ""}`,
    latestReadyVersion === null ? "-" : `v${latestReadyVersion.version}`,
    Option.fromNullishOr(latestReadyVersion?.contentHash).pipe(
      Option.map((contentHash) => contentHash.slice(0, 12)),
      Option.getOrElse(() => "-"),
    ),
    warningsCell((latestReadyVersion ?? latestVersion)?.warnings ?? []),
  ]),
];

/** `registry` holds the components the installs are of, to tell which are deprecated. */
const installedRows = (
  installs: ReadonlyArray<PublishedComponentInstallJsonEncoding>,
  registry: ReadonlyArray<PublishedComponentJsonEncoding>,
) => [
  ["COMPONENT", "VERSION", "RANGE", "UPDATE", "STATUS", "CAPABILITIES"],
  ...installs.map((install) => [
    install.slug,
    install.version,
    install.versionRange,
    install.availableUpdate ?? "-",
    registry.some(({ id, isDeprecated }) => isDeprecated && id === install.registryComponentId)
      ? `${install.versionStatus} (component deprecated)`
      : install.versionStatus,
    install.consentedCapabilities.join(", ") || "-",
  ]),
];

/**
 * `installs` are the project's installs; `projects` the projects the signed-in
 * person can use, which name the owners.
 */
const registryRows = (
  components: ReadonlyArray<PublishedComponentJsonEncoding>,
  installs: ReadonlyArray<PublishedComponentInstallJsonEncoding>,
  projects: ReadonlyArray<SessionProjectJsonEncoding>,
) => [
  ["COMPONENT", "TITLE", "OWNER", "LATEST", "INSTALLED"],
  ...components.map(({ installId, isDeprecated, latestVersion, ownerProjectId, slug, title }) => [
    slug,
    isDeprecated ? `${title} (deprecated)` : title,
    ownerProjectId === null
      ? "-"
      : (projects.find(({ id }) => id === ownerProjectId)?.name ?? ownerProjectId),
    latestVersion ?? "-",
    installs.find(({ id }) => id === installId)?.version ?? "-",
  ]),
];

/**
 * `voidhash-cli registry list`
 *
 * Prints the project's own components with their newest versions, the
 * registry components it has installed, and every component of the
 * organization's registry.
 */
export const componentsListCommand = Command.make(
  "list",
  { project: projectOption },
  ({ project }) =>
    Effect.gen(function* componentsListCommand() {
      const apiClient = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const [components, installs, registry, session] = yield* Effect.all(
        [
          readAll((query) =>
            apiClient.componentsList(projectId, query).pipe(Effect.mapError(componentApiUserError)),
          ),
          readAll((query) =>
            apiClient
              .componentRegistryListInstalls(projectId, query)
              .pipe(Effect.mapError(componentApiUserError)),
          ),
          readAll((query) =>
            apiClient
              .componentRegistryList(projectId, query)
              .pipe(Effect.mapError(componentApiUserError)),
          ),
          apiClient.sessionGet().pipe(Effect.mapError(componentApiUserError)),
        ],
        { concurrency: 4 },
      );

      const sections = [
        "Project components",
        Arr.isReadonlyArrayEmpty(components)
          ? "  None yet. Create one with 'voidhash-cli new <name>', then 'voidhash-cli publish'."
          : table(projectRows(components)),
        "",
        "Installed",
        Arr.isReadonlyArrayEmpty(installs)
          ? "  None. Install one with 'voidhash-cli registry install <publisher>/<name>'."
          : table(installedRows(installs, registry)),
        ...(installs.some((install) => install.availableUpdate !== null)
          ? ["  Move an install to its UPDATE with 'voidhash-cli registry update <component>'."]
          : []),
        "",
        "Organization registry",
        Arr.isReadonlyArrayEmpty(registry)
          ? "  Nothing published yet. Publish with 'voidhash-cli registry publish'."
          : table(registryRows(registry, installs, session.projects)),
      ];
      yield* Console.log(sections.join("\n"));
    }),
).pipe(
  Command.withDescription(
    "List the project's components, its installed components, and your organization's registry.",
  ),
);
