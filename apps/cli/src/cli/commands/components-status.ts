import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Argument, Command, Flag } from "effect/cli";

import { ApiClient } from "../../utils/api-client";
import { componentApiUserError } from "../../utils/components/component-api";
import { findRegistryComponent, findRegistryVersion } from "../../utils/components/registry";
import { resolveProject } from "../context";
import { projectOption } from "../shared-options";

const componentIdArgument = Argument.String("component").pipe(
  Argument.withDescription("Registry component id, such as acme/wheel-picker"),
);

const messageFlag = Flag.String("message").pipe(
  Flag.withDescription("Why, shown wherever the component is used"),
  Flag.optional,
);

/**
 * `voidhash-cli registry deprecate <component> [version] [--message] [--undo]`
 *
 * Deprecates one version, or the whole component without a version.
 * Deprecated components cannot be newly installed or inserted, and
 * deprecated versions cannot be published again; published paywalls keep
 * working. `--undo` lifts the deprecation.
 */
export const componentsDeprecateCommand = Command.make(
  "deprecate",
  {
    component: componentIdArgument,
    version: Argument.String("version").pipe(
      Argument.withDescription("The version to deprecate (the whole component when omitted)"),
      Argument.optional,
    ),
    message: messageFlag,
    undo: Flag.Boolean("undo").pipe(
      Flag.withDescription("Lift the deprecation"),
      Flag.withDefault(false),
    ),
    project: projectOption,
  },
  ({ component, message, project, undo, version }) =>
    Effect.gen(function* componentsDeprecateCommand() {
      const apiClient = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const registryComponent = yield* findRegistryComponent(apiClient, projectId, component);
      const { slug } = registryComponent;
      if (Option.isSome(version)) {
        const found = yield* findRegistryVersion(
          apiClient,
          projectId,
          registryComponent,
          version.value,
        );
        yield* apiClient
          .componentRegistryUpdateVersion(projectId, registryComponent.id, found.id, {
            status: undo ? "ready" : "deprecated",
            statusMessage: Option.getOrUndefined(message),
          })
          .pipe(Effect.mapError(componentApiUserError));
        yield* Console.log(
          undo
            ? `✓ ${slug} ${version.value} is no longer deprecated.`
            : `✓ Deprecated ${slug} ${version.value}. Published paywalls keep working.`,
        );
        return;
      }
      yield* apiClient
        .componentRegistryUpdate(projectId, registryComponent.id, {
          isDeprecated: !undo,
          deprecationMessage: Option.getOrUndefined(message),
        })
        .pipe(Effect.mapError(componentApiUserError));
      yield* Console.log(
        undo
          ? `✓ ${slug} is no longer deprecated.`
          : `✓ Deprecated ${slug}. It cannot be newly installed or inserted; published paywalls keep working.`,
      );
    }),
).pipe(Command.withDescription("Deprecate a component or one of its versions."));

/**
 * `voidhash-cli registry transfer <component> [--project]`
 *
 * Makes the project the owner of a registry component, so people who may
 * publish paywalls in it can publish new versions, deprecate and yank. The
 * previous owner loses that access. Needs an organization admin signed in
 * with `auth login`.
 */
export const componentsTransferCommand = Command.make(
  "transfer",
  { component: componentIdArgument, project: projectOption },
  ({ component, project }) =>
    Effect.gen(function* componentsTransferCommand() {
      const apiClient = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const registryComponent = yield* findRegistryComponent(apiClient, projectId, component);
      yield* apiClient
        .componentRegistryUpdate(projectId, registryComponent.id, { ownerProjectId: projectId })
        .pipe(Effect.mapError(componentApiUserError));
      yield* Console.log(
        `✓ ${registryComponent.slug} now belongs to the project. People who may publish paywalls in it can publish, deprecate and yank its versions.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Move a component to another project of your organization (organization admins, signed in with auth login).",
  ),
);

/**
 * `voidhash-cli registry yank <component> <version> [--message]`
 *
 * Yanks a version for good: it can no longer be installed, inserted or
 * published. Paywalls already published with it keep working.
 */
export const componentsYankCommand = Command.make(
  "yank",
  {
    component: componentIdArgument,
    version: Argument.String("version").pipe(Argument.withDescription("The version to yank")),
    message: messageFlag,
    project: projectOption,
  },
  ({ component, message, project, version }) =>
    Effect.gen(function* componentsYankCommand() {
      const apiClient = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const registryComponent = yield* findRegistryComponent(apiClient, projectId, component);
      const found = yield* findRegistryVersion(apiClient, projectId, registryComponent, version);
      yield* apiClient
        .componentRegistryUpdateVersion(projectId, registryComponent.id, found.id, {
          status: "yanked",
          statusMessage: Option.getOrUndefined(message),
        })
        .pipe(Effect.mapError(componentApiUserError));
      yield* Console.log(
        `✓ Yanked ${registryComponent.slug} ${version}. It cannot be installed, inserted or published again; published paywalls keep working.`,
      );
    }),
).pipe(Command.withDescription("Yank a component version for good."));
