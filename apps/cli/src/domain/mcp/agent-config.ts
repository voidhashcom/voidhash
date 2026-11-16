/**
 * Adds the Voidhash MCP server to agents' configuration. Nothing secret is
 * written: an agent signs in through the person's browser on its first
 * request and then acts as them.
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

/** The name agents list Voidhash under. */
export const MCP_SERVER_NAME = "voidhash";

/** The MCP endpoint of the API at `apiUrl`. */
export const mcpServerUrl = (apiUrl: string): string => `${apiUrl.replace(/\/+$/, "")}/api/mcp`;

const JsonObject = Schema.Record(Schema.String, Schema.Unknown);
const JsonObjectFile = Schema.fromJsonString(JsonObject, { space: 2 });
const decodeObject = Schema.decodeUnknownOption(JsonObject);

/**
 * Cursor's `mcp.json` with the Voidhash server set to `url`, keeping every
 * other server and setting. Fails when the existing file is not a JSON object,
 * rather than overwriting it.
 */
export const withCursorServer = Effect.fnUntraced(function* (
  existing: Option.Option<string>,
  url: string,
) {
  const config = yield* Option.match(Option.filter(existing, Str.isNonEmpty), {
    onNone: () => Effect.succeed<Record<string, unknown>>({}),
    onSome: (content) => Schema.decodeEffect(JsonObjectFile)(content),
  });
  const servers = Option.getOrElse(decodeObject(config["mcpServers"]), () => ({}));
  const content = yield* Schema.encodeEffect(JsonObjectFile)({
    ...config,
    mcpServers: { ...servers, [MCP_SERVER_NAME]: { url } },
  });
  return `${content}\n`;
});

/**
 * Codex's `config.toml` with a Voidhash server section added, or none when one
 * is already there (left as the person configured it).
 */
export const withCodexServer = (
  existing: Option.Option<string>,
  url: string,
): Option.Option<string> => {
  const content = Option.getOrElse(existing, () => "");
  const header = `[mcp_servers.${MCP_SERVER_NAME}]`;
  if (content.split(/\r?\n/).some((line) => line.trim() === header)) return Option.none();
  const separator =
    Str.isEmpty(content) || content.endsWith("\n\n") ? "" : content.endsWith("\n") ? "\n" : "\n\n";
  return Option.some(`${content}${separator}${header}\nurl = "${url}"\n`);
};

/** The JSON VS Code's `--add-mcp` flag takes. */
export const vscodeServer = (url: string) =>
  Schema.encodeEffect(Schema.fromJsonString(JsonObject))({
    name: MCP_SERVER_NAME,
    type: "http",
    url,
  });
