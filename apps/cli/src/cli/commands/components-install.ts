import type {
  PublishedComponentInstallReviewJsonEncoding,
  PublishedComponentJsonEncoding,
} from "@voidhash/generated-clients";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Argument, Command, Flag } from "effect/cli";

import { ApiClient } from "../../utils/api-client";
import { componentApiUserError } from "../../utils/components/component-api";
import {
  consentForReview,
  findRegistryComponent,
  formatInstall,
  formatInstallReview,
} from "../../utils/components/registry";
import { userError } from "../../utils/error-formatter";
import { resolveProject } from "../context";
import { projectOption } from "../shared-options";

const componentIdArgument = Argument.String("component").pipe(
  Argument.withDescription("Registry component id, such as acme/wheel-picker"),
);

const rangeFlag = Flag.String("range").pipe(
  Flag.withDescription("Version range: *, an exact version, ^1.2.3 or ~1.2.3"),
  Flag.optional,
);

const yesFlag = Flag.Boolean("yes").pipe(
  Flag.withAlias("y"),
  Flag.withDescription("Accept the capabilities and changes the review shows"),
  Flag.withDefault(false),
);

/**
 * Prints the review of `component`, and returns the consent to send: none when
 * nothing needs accepting, the reviewed version with `--yes`, and otherwise a
 * failure that asks for `--yes`.
 */
const reviewConsent = (
  component: PublishedComponentJsonEncoding,
  review: PublishedComponentInstallReviewJsonEncoding,
  accepted: boolean,
) =>
  Effect.gen(function* () {
    yield* Console.log(formatInstallReview(component.slug, review));
    if (!review.isConsentRequired) return undefined;
    if (!accepted) {
      return yield* Effect.fail(
        userError(
          "\nThis needs your consent: review the capabilities and changes above, then run the command again with --yes.",
        ),
      );
    }
    return consentForReview(review);
  });

/** The project's install of `component`, or a failure saying it has none. */
const requireInstall = (component: PublishedComponentJsonEncoding) =>
  Effect.fromOption(Option.fromNullishOr(component.installId)).pipe(
    Effect.mapError(() =>
      userError(
        `${component.slug} is not installed in this project. Install it with 'voidhash-cli registry install ${component.slug}'.`,
      ),
    ),
  );

/**
 * `voidhash-cli registry install <component> [--range] [--yes]`
 *
 * Installs a component of your organization's registry into the project
 * after showing what it asks for.
 */
export const componentsInstallCommand = Command.make(
  "install",
  { component: componentIdArgument, range: rangeFlag, yes: yesFlag, project: projectOption },
  ({ component, project, range, yes }) =>
    Effect.gen(function* componentsInstallCommand() {
      const apiClient = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const registryComponent = yield* findRegistryComponent(apiClient, projectId, component);
      const versionRange = Option.getOrUndefined(range);
      const review = yield* apiClient
        .componentRegistryGetInstallReview(projectId, registryComponent.id, { versionRange })
        .pipe(Effect.mapError(componentApiUserError));
      const consent = yield* reviewConsent(registryComponent, review, yes);
      const install = yield* apiClient
        .componentRegistryCreateInstall(projectId, {
          registryComponentId: registryComponent.id,
          versionRange,
          consent,
        })
        .pipe(Effect.mapError(componentApiUserError));
      yield* Console.log(`\n✓ Installed ${formatInstall(install)}.`);
    }),
).pipe(Command.withDescription("Install a component from your organization's registry."));

/**
 * `voidhash-cli registry update <component> [--range] [--yes]`
 *
 * Moves an install to the newest version in its range (or a new range).
 * Components already placed in paywalls keep their version until moved.
 */
export const componentsUpdateCommand = Command.make(
  "update",
  { component: componentIdArgument, range: rangeFlag, yes: yesFlag, project: projectOption },
  ({ component, project, range, yes }) =>
    Effect.gen(function* componentsUpdateCommand() {
      const apiClient = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const registryComponent = yield* findRegistryComponent(apiClient, projectId, component);
      const installId = yield* requireInstall(registryComponent);
      const versionRange = Option.getOrUndefined(range);
      const review = yield* apiClient
        .componentRegistryGetInstallReview(projectId, registryComponent.id, { versionRange })
        .pipe(Effect.mapError(componentApiUserError));
      if (review.currentVersionId === review.targetVersionId) {
        yield* Console.log(`${registryComponent.slug} is already on ${review.targetVersion}.`);
        return;
      }
      const consent = yield* reviewConsent(registryComponent, review, yes);
      const install = yield* apiClient
        .componentRegistryUpdateInstall(projectId, installId, { versionRange, consent })
        .pipe(Effect.mapError(componentApiUserError));
      yield* Console.log(`\n✓ Updated ${formatInstall(install)}.`);
    }),
).pipe(
  Command.withDescription("Update an installed component to the newest version in its range."),
);

/**
 * `voidhash-cli registry uninstall <component>`
 *
 * Removes a component from the project. Published paywalls keep working.
 */
export const componentsUninstallCommand = Command.make(
  "uninstall",
  { component: componentIdArgument, project: projectOption },
  ({ component, project }) =>
    Effect.gen(function* componentsUninstallCommand() {
      const apiClient = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const registryComponent = yield* findRegistryComponent(apiClient, projectId, component);
      const installId = yield* requireInstall(registryComponent);
      yield* apiClient
        .componentRegistryDeleteInstall(projectId, installId)
        .pipe(Effect.mapError(componentApiUserError));
      yield* Console.log(
        `✓ Uninstalled ${registryComponent.slug}. Published paywalls keep working; paywalls that still place it cannot be published until it is removed or installed again.`,
      );
    }),
).pipe(Command.withDescription("Remove an installed component from the project."));
