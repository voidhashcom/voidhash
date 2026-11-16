import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { Argument, Command } from "effect/cli";

import { ApiClient } from "../../utils/api-client";
import { componentApiUserError } from "../../utils/components/component-api";
import { resolveProject } from "../context";
import { projectOption } from "../shared-options";

/**
 * `voidhash-cli registry publisher show`
 *
 * Prints the namespace the project's organization publishes components under.
 */
const publisherShowCommand = Command.make("show", { project: projectOption }, ({ project }) =>
  Effect.gen(function* publisherShowCommand() {
    const apiClient = yield* ApiClient;
    const projectId = (yield* resolveProject(project)).project.id;
    const publisher = yield* apiClient
      .componentRegistryGetPublisher(projectId)
      .pipe(Effect.mapError(componentApiUserError));
    yield* Console.log(
      `Namespace: ${publisher.namespace}\nComponents publish as ${publisher.namespace}/<name>.`,
    );
  }),
).pipe(Command.withDescription("Show the organization's component namespace."));

/**
 * `voidhash-cli registry publisher claim <namespace>`
 *
 * Claims the organization's namespace, or renames it while nothing is
 * published. Needs an organization admin signed in with `auth login`.
 */
const publisherClaimCommand = Command.make(
  "claim",
  {
    namespace: Argument.String("namespace").pipe(
      Argument.withDescription("Lowercase letters, digits and dashes, at most 39 characters"),
    ),
    project: projectOption,
  },
  ({ namespace, project }) =>
    Effect.gen(function* publisherClaimCommand() {
      const apiClient = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const publisher = yield* apiClient
        .componentRegistryUpsertPublisher(projectId, { namespace })
        .pipe(Effect.mapError(componentApiUserError));
      yield* Console.log(
        `✓ Your organization publishes components as ${publisher.namespace}/<name>.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Claim the organization's component namespace (organization admins, signed in with auth login).",
  ),
);

export const componentsPublisherCommand = Command.make("publisher", {}, () => Effect.void).pipe(
  Command.withDescription(
    "Show or claim the namespace your organization publishes components under.",
  ),
  Command.withSubcommands([publisherShowCommand, publisherClaimCommand]),
);
