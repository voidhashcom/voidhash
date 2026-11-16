import * as Effect from "effect/Effect";
import { Command } from "effect/cli";

import {
  componentsInstallCommand,
  componentsUninstallCommand,
  componentsUpdateCommand,
} from "./components-install";
import { componentsListCommand } from "./components-list";
import { componentsPublishCommand } from "./components-publish";
import { componentsPublisherCommand } from "./components-publisher";
import {
  componentsDeprecateCommand,
  componentsTransferCommand,
  componentsYankCommand,
} from "./components-status";

/** `voidhash-cli registry …`: the organization's component registry and the project's installs. */
export const registryCommand = Command.make("registry", {}, () => Effect.void).pipe(
  Command.withDescription(
    "Publish components to your organization's registry, and install and manage registry components.",
  ),
  Command.withSubcommands([
    componentsListCommand,
    componentsPublishCommand,
    componentsInstallCommand,
    componentsUpdateCommand,
    componentsUninstallCommand,
    componentsDeprecateCommand,
    componentsYankCommand,
    componentsTransferCommand,
    componentsPublisherCommand,
  ]),
);
