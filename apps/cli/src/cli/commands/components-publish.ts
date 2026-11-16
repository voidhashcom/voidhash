import type { PublishedComponentVersionJsonEncoding } from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Argument, Command, Flag } from "effect/cli";

import { ApiClient, type ApiClientShape } from "../../utils/api-client";
import { componentApiUserError } from "../../utils/components/component-api";
import { readComponentBundle } from "../../utils/components/component-bundle";
import { formatRegistryVersion, parseProjectVersion } from "../../utils/components/registry";
import { userError } from "../../utils/error-formatter";
import { resolveProject } from "../context";
import { projectOption } from "../shared-options";

/** Prints a version just published, under the slug of its registry component. */
const printPublished = (
  apiClient: ApiClientShape,
  projectId: string,
  published: PublishedComponentVersionJsonEncoding,
) =>
  Effect.gen(function* () {
    const component = yield* apiClient
      .componentRegistryGet(projectId, published.registryComponentId)
      .pipe(Effect.mapError(componentApiUserError));
    yield* Console.log(`✓ Published ${component.slug} ${published.version}.\n`);
    yield* Console.log(formatRegistryVersion(component.slug, published));
  });

/**
 * `voidhash-cli registry publish [path]`
 * `voidhash-cli registry publish --from-project <slug>@<version> --version <semver>`
 *
 * Publishes a component to the organization's registry, where every project
 * of the organization can install it. A bundle directory holds
 * `component.json` and the module (see `readComponentBundle`); with
 * `--from-project`, a ready version of one of the project's components is
 * published instead. The server runs every publish check.
 */
export const componentsPublishCommand = Command.make(
  "publish",
  {
    path: Argument.String("path").pipe(
      Argument.withDescription(
        "A bundle directory with component.json (the current directory by default)",
      ),
      Argument.optional,
    ),
    fromProject: Flag.String("from-project").pipe(
      Flag.withDescription(
        "Publish a ready project component version instead, as <slug>@<version>",
      ),
      Flag.optional,
    ),
    version: Flag.String("version").pipe(
      Flag.withDescription(
        "Semantic version to publish a project component as (with --from-project)",
      ),
      Flag.optional,
    ),
    name: Flag.String("name").pipe(
      Flag.withDescription("Registry name (with --from-project; defaults to the slug)"),
      Flag.optional,
    ),
    title: Flag.String("title").pipe(
      Flag.withDescription("Display title (with --from-project)"),
      Flag.optional,
    ),
    category: Flag.String("category").pipe(
      Flag.withDescription("Editor category (with --from-project)"),
      Flag.optional,
    ),
    project: projectOption,
  },
  ({ category, fromProject, name, path, project, title, version }) =>
    Effect.gen(function* componentsPublishCommand() {
      const apiClient = yield* ApiClient;

      if (Option.isSome(fromProject)) {
        const source = parseProjectVersion(fromProject.value);
        if (Option.isNone(source)) {
          return yield* Effect.fail(
            userError(
              `--from-project takes <slug>@<version>, such as plan-picker@3; got "${fromProject.value}".`,
            ),
          );
        }
        if (Option.isNone(version)) {
          return yield* Effect.fail(
            userError("--from-project needs --version, such as --version 1.0.0."),
          );
        }
        const { slug, version: number } = source.value;
        const projectId = (yield* resolveProject(project)).project.id;
        const component = yield* apiClient.componentsList(projectId, { slug }).pipe(
          Effect.mapError(componentApiUserError),
          Effect.flatMap((page) =>
            Effect.fromOption(Arr.head(page.data), () =>
              userError(`The project has no component ${slug}.`),
            ),
          ),
        );
        const componentVersion = yield* apiClient
          .componentsListVersions(projectId, component.id, { version: number })
          .pipe(
            Effect.mapError(componentApiUserError),
            Effect.flatMap((page) =>
              Effect.fromOption(Arr.head(page.data), () =>
                userError(`${slug} has no version ${number}.`),
              ),
            ),
          );
        const published = yield* apiClient
          .componentRegistryCreateVersionFromComponent(projectId, {
            componentVersionId: componentVersion.id,
            version: version.value,
            name: Option.getOrUndefined(name),
            title: Option.getOrUndefined(title),
            category: Option.getOrUndefined(category),
          })
          .pipe(Effect.mapError(componentApiUserError));
        yield* printPublished(apiClient, projectId, published);
        return;
      }

      const directory = Option.getOrElse(path, () => ".");
      const bundle = yield* readComponentBundle(directory).pipe(
        Effect.catchTag("PlatformError", (error) =>
          Effect.fail(userError(`Could not read the bundle in ${directory}: ${error.message}`)),
        ),
      );
      const projectId = (yield* resolveProject(project)).project.id;
      yield* Console.log(`Publishing ${directory} (module ${bundle.modulePath})...`);
      const published = yield* apiClient
        .componentRegistryCreateVersionFromBundle(projectId, bundle.body)
        .pipe(Effect.mapError(componentApiUserError));
      yield* printPublished(apiClient, projectId, published);
    }),
).pipe(
  Command.withDescription(
    "Publish a component bundle, or a ready project component, to your organization's registry.",
  ),
);
