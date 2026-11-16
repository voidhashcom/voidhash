import * as Arr from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import type * as PlatformError from "effect/PlatformError";
import type * as Schema from "effect/Schema";
import { Command, Flag, Prompt } from "effect/cli";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import {
  MCP_SERVER_NAME,
  mcpServerUrl,
  vscodeServer,
  withCodexServer,
  withCursorServer,
} from "../../domain/mcp/agent-config";
import { CliConfig } from "../../domain/services/cli-config";

/**
 * Runs a command with inherited output and returns its exit code, or
 * `Option.none` when the executable is not installed.
 */
const run = (command: string, args: ReadonlyArray<string>, output: "inherit" | "ignore") =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const handle = yield* spawner.spawn(
      ChildProcess.make(command, [...args], { stdout: output, stderr: output }),
    );
    return Option.some(Number(yield* handle.exitCode));
  }).pipe(
    Effect.scoped,
    Effect.catchTag("PlatformError", (error) =>
      error.reason._tag === "NotFound" ? Effect.succeed(Option.none<number>()) : Effect.fail(error),
    ),
  );

const isInstalled = (command: string) =>
  run(command, ["--version"], "ignore").pipe(
    Effect.map(Option.exists((code) => code === 0)),
    Effect.orElseSucceed(() => false),
  );

/** An agent `mcp install` knows how to configure. */
interface Agent {
  readonly label: string;
  /** Whether it is installed on this computer. */
  readonly detect: Effect.Effect<
    boolean,
    never,
    FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner
  >;
  /** Adds the server; returns what to tell the person. */
  readonly install: (
    url: string,
  ) => Effect.Effect<
    string,
    PlatformError.PlatformError | Schema.SchemaError,
    FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner
  >;
}

const agents = (home: string, path: Path.Path, platform: NodeJS.Platform): ReadonlyArray<Agent> => {
  const cursorConfig = path.join(home, ".cursor", "mcp.json");
  const codexConfig = path.join(home, ".codex", "config.toml");
  const claudeDesktopDir =
    platform === "darwin"
      ? path.join(home, "Library", "Application Support", "Claude")
      : platform === "win32"
        ? path.join(home, "AppData", "Roaming", "Claude")
        : path.join(home, ".config", "Claude");
  const exists = (file: string) =>
    Effect.flatMap(FileSystem.FileSystem, (fs) => fs.exists(file)).pipe(
      Effect.orElseSucceed(() => false),
    );
  const readIfExists = (file: string) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return (yield* fs.exists(file))
        ? Option.some(yield* fs.readFileString(file))
        : Option.none<string>();
    });
  const write = (file: string, content: string) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.makeDirectory(path.dirname(file), { recursive: true });
      yield* fs.writeFileString(file, content);
    });

  return [
    {
      label: "Claude Code",
      detect: isInstalled("claude"),
      install: (url) =>
        run(
          "claude",
          ["mcp", "add", "--transport", "http", "--scope", "user", MCP_SERVER_NAME, url],
          "inherit",
        ).pipe(
          Effect.map((code) =>
            Option.contains(code, 0)
              ? "added for every project (user scope)"
              : "not changed; it may already list a voidhash server (claude mcp list)",
          ),
        ),
    },
    {
      label: "Cursor",
      detect: exists(path.join(home, ".cursor")),
      install: (url) =>
        readIfExists(cursorConfig).pipe(
          Effect.flatMap((existing) => withCursorServer(existing, url)),
          Effect.flatMap((content) => write(cursorConfig, content)),
          Effect.as(`added to ${cursorConfig}`),
        ),
    },
    {
      label: "Codex",
      detect: Effect.zipWith(
        exists(path.join(home, ".codex")),
        isInstalled("codex"),
        (a, b) => a || b,
      ),
      install: (url) =>
        readIfExists(codexConfig).pipe(
          Effect.flatMap((existing) =>
            Option.match(withCodexServer(existing, url), {
              onNone: () => Effect.succeed(`already in ${codexConfig}`),
              onSome: (updated) =>
                write(codexConfig, updated).pipe(Effect.as(`added to ${codexConfig}`)),
            }),
          ),
        ),
    },
    {
      label: "VS Code",
      detect: isInstalled("code"),
      install: (url) =>
        vscodeServer(url).pipe(
          Effect.flatMap((server) => run("code", ["--add-mcp", server], "ignore")),
          Effect.map((code) =>
            Option.contains(code, 0) ? "added to your user settings" : "could not be updated",
          ),
        ),
    },
    {
      label: "Claude Desktop",
      detect: exists(claudeDesktopDir),
      // Its configuration file lists only local servers; remote ones are connectors.
      install: (url) =>
        Effect.succeed(`open Settings → Connectors → Add custom connector, and paste ${url}`),
    },
  ];
};

/**
 * `voidhash-cli mcp install`: adds the Voidhash MCP server to the AI agents
 * installed on this computer. No key is written anywhere; each agent signs in
 * through the browser the first time it uses Voidhash and then acts as you.
 */
export const installMcpServer = Effect.fn("installMcpServer")(function* (options: {
  readonly yes: boolean;
}) {
  const cliConfig = yield* CliConfig;
  const path = yield* Path.Path;
  const home = yield* Config.String("HOME").pipe(Effect.orDie);
  const url = mcpServerUrl((yield* cliConfig.readConfig()).api_url);

  const detected = yield* Effect.filter(
    agents(home, path, process.platform),
    (agent) => agent.detect,
  );
  if (Arr.isReadonlyArrayEmpty(detected)) {
    yield* Console.log(
      `No supported agents found. Add this MCP server to your agent:\n\n  ${url}\n\nSee https://voidhash.com/docs/mcp for each agent's steps.`,
    );
    return;
  }

  const chosen = options.yes
    ? detected
    : yield* Prompt.run(
        Prompt.MultiSelect({
          message: "Add Voidhash to these agents?",
          choices: detected.map((agent) => ({ title: agent.label, value: agent, selected: true })),
        }),
      );

  yield* Effect.forEach(
    chosen,
    (agent) =>
      agent.install(url).pipe(
        Effect.catchTags({
          PlatformError: (error) => Effect.succeed(`failed: ${error.message}`),
          SchemaError: () =>
            Effect.succeed(
              "failed: its configuration file is not valid JSON, so it was left as is",
            ),
        }),
        Effect.flatMap((outcome) => Console.log(`  ${agent.label}: ${outcome}`)),
      ),
    // One at a time: agents' own commands print to the same terminal.
    { concurrency: 1 },
  );
  if (Arr.isReadonlyArrayNonEmpty(chosen)) {
    yield* Console.log(
      "\nThe first time an agent uses Voidhash, your browser opens to sign in. It then acts as you; make it read-only under Settings → Devices and apps.",
    );
  }
});

/** `voidhash-cli mcp`: connects AI agents to Voidhash. */
export const mcpCommand = Command.make("mcp", {}, () => Effect.void).pipe(
  Command.withDescription("Connect AI agents to Voidhash over MCP."),
  Command.withSubcommands([
    Command.make(
      "install",
      {
        yes: Flag.Boolean("yes").pipe(
          Flag.withAlias("y"),
          Flag.withDescription("Configure every detected agent without asking"),
        ),
      },
      (options) => installMcpServer(options),
    ).pipe(
      Command.withDescription(
        "Add the Voidhash MCP server to the AI agents on this computer. Writes no secrets; agents sign in in your browser.",
      ),
    ),
  ]),
);
