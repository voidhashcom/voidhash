import { Config, Console, Effect, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { CliConfig } from "../../domain/services/cli-config";
import { userError } from "../../utils/error-formatter";

const projectFlag = Flag.string("project").pipe(
  Flag.withDescription("Project id or slug for MCP requests"),
  Flag.withDefault(""),
);

/** The optional project header, omitted when no project is selected. */
const projectHeader = (project: string | undefined): Record<string, string> => {
  if (project === undefined || project.length === 0) return {};
  return { "X-Voidhash-Project": project };
};

/** Builds the JSON object expected from a Claude Code MCP headers helper. */
export const buildMcpHeaders = (
  apiKey: string,
  project: string | undefined,
): Record<string, string> => ({
  Authorization: `Bearer ${apiKey}`,
  ...projectHeader(project),
});

/** Serializes the MCP headers object to the JSON printed on stdout. */
const McpHeadersJson = Schema.fromJsonString(Schema.Record(Schema.String, Schema.String));

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
    const pluginProject = yield* Config.string("CLAUDE_PLUGIN_OPTION_PROJECT").pipe(
      Config.withDefault(""),
      Effect.orDie,
    );
    const envProject = yield* Config.string("VOIDHASH_PROJECT").pipe(
      Config.withDefault(""),
      Effect.orDie,
    );
    const selectedProject = project.trim() || pluginProject.trim() || envProject.trim();
    const headersJson = yield* Schema.encodeEffect(McpHeadersJson)(
      buildMcpHeaders(config.api_key, selectedProject),
    ).pipe(Effect.orDie);
    yield* Console.log(headersJson);
  }),
).pipe(Command.withDescription("Print MCP connection headers from the current CLI login."));
