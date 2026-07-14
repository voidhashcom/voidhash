import { Console, Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { CliConfig } from "../../domain/services/cli-config";
import { userError } from "../../utils/error-formatter";

const projectFlag = Flag.string("project").pipe(
  Flag.withDescription("Project id or slug for MCP requests"),
  Flag.withDefault(""),
);

/** Builds the JSON object expected from a Claude Code MCP headers helper. */
export const buildMcpHeaders = (
  apiKey: string,
  project: string | undefined,
): Record<string, string> => ({
  Authorization: `Bearer ${apiKey}`,
  ...(project === undefined || project.length === 0 ? {} : { "X-Voidhash-Project": project }),
});

/** Prints authenticated MCP request headers without exposing them as arguments. */
export const authTokenCommand = Command.make("token", { project: projectFlag }, ({ project }) =>
  Effect.gen(function* authTokenCommand() {
    const cliConfig = yield* CliConfig;
    const config = yield* cliConfig.readConfig();
    if (config.api_key === null || config.api_key === undefined || config.api_key.length === 0) {
      return yield* Effect.fail(
        userError("You must be logged in. Run 'voidhash-cli auth login' first."),
      );
    }
    const selectedProject =
      project.trim() ||
      process.env.CLAUDE_PLUGIN_OPTION_PROJECT?.trim() ||
      process.env.VOIDHASH_PROJECT?.trim();
    yield* Console.log(JSON.stringify(buildMcpHeaders(config.api_key, selectedProject)));
  }),
).pipe(Command.withDescription("Print MCP connection headers from the current CLI login."));
