import { Command } from "effect/cli";

import { adsCommand } from "./commands/ads";
import { analyticsCommand } from "./commands/analytics";
import { apiCommand } from "./commands/api";
import { eventsCommand } from "./commands/events";
import { experimentCommand } from "./commands/experiment";
import { flagCommand } from "./commands/flag";
import { insightsCommand } from "./commands/insights";
import { loginCommand } from "./commands/auth-login";
import { logoutCommand } from "./commands/auth-logout";
import { authCommand } from "./commands/auth";
import { componentsTestCommand } from "./commands/components-test";
import { configCommand } from "./commands/config";
import { devCommand } from "./commands/dev";
import { initCommand } from "./commands/init";
import { linkCommand, switchCommand, unlinkCommand } from "./commands/link";
import { mcpCommand } from "./commands/mcp-install";
import { newCommand } from "./commands/new";
import { locationCommand } from "./commands/location";
import { openCommand } from "./commands/open";
import { paywallCommand } from "./commands/paywall";
import { perkCommand } from "./commands/perk";
import { personCommand } from "./commands/person";
import { productCommand } from "./commands/product";
import { providerCommand } from "./commands/provider";
import { publishCommand } from "./commands/publish";
import { registryCommand } from "./commands/registry";
import { statusCommand } from "./commands/status";
import { typesCommand } from "./commands/types";
import { webhookCommand } from "./commands/webhook";
import { whoamiCommand } from "./commands/whoami";
import { auditCommand } from "./commands/audit";
import { domainCommand } from "./commands/domain";
import { feedbackCommand } from "./commands/feedback";
import { keyCommand } from "./commands/key";
import { memberCommand } from "./commands/member";
import { noticesCommand } from "./commands/notices";
import { orgCommand } from "./commands/org";
import { projectCommand } from "./commands/project";
import { pushCommand } from "./commands/push";
import { sandboxCommand } from "./commands/sandbox";
import { settingsCommand } from "./commands/settings";
import { debugOption, profileOption } from "./shared-options";

/** The CLI's version, as `--version` prints it. */
export const VERSION = "0.0.1-alpha.1";

/**
 * Every command of the CLI, `voidhash <noun> <verb>`. Without a subcommand it
 * prints its help, as every command group does.
 */
export const rootCommand = Command.make("voidhash", { debug: debugOption }).pipe(
  Command.withDescription(
    [
      "Manage your Voidhash projects from the terminal. 'voidhash-cli status' is a good place to start.",
      "",
      "  Environment, for CI and scripts:",
      "    VOIDHASH_API_KEY  A project secret key or a person's token; used instead of the stored sign-in",
      "    VOIDHASH_API_URL  The API server, instead of the configured api_url",
      "    VOIDHASH_PROFILE  The config profile, when --profile is not passed",
    ].join("\n"),
  ),
  // Shared flags are accepted before and after the subcommand name (npm-style).
  // Must be applied before withSubcommands.
  Command.withSharedFlags({ profile: profileOption }),
  Command.withSubcommands([
    { group: "Get started", commands: [initCommand, loginCommand, logoutCommand, whoamiCommand] },
    {
      group: "Choose a project",
      commands: [statusCommand, linkCommand, unlinkCommand, switchCommand, openCommand],
    },
    { group: "Persons and access", commands: [personCommand] },
    { group: "Catalog", commands: [productCommand, perkCommand] },
    { group: "Payments", commands: [providerCommand] },
    { group: "Paywalls", commands: [paywallCommand, locationCommand] },
    { group: "Flags and experiments", commands: [flagCommand, experimentCommand] },
    {
      group: "Analytics and ads",
      commands: [eventsCommand, insightsCommand, analyticsCommand, adsCommand],
    },
    { group: "Your backend", commands: [webhookCommand] },
    { group: "Messaging", commands: [pushCommand] },
    {
      group: "Team and settings",
      commands: [
        orgCommand,
        projectCommand,
        memberCommand,
        settingsCommand,
        domainCommand,
        sandboxCommand,
        keyCommand,
        auditCommand,
        noticesCommand,
        feedbackCommand,
      ],
    },
    {
      group: "Paywall components",
      commands: [devCommand, newCommand, publishCommand, componentsTestCommand, registryCommand],
    },
    {
      group: "More",
      commands: [typesCommand, mcpCommand, apiCommand, authCommand, configCommand],
    },
  ]),
);
