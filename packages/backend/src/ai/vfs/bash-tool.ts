/**
 * The just-bash execution seam behind the `bash` workspace tool: a fresh,
 * sandboxed shell per invocation over {@link makeWorkspaceVfs}. No network, no
 * script runtimes — the default pure-JS command set (grep/sed/awk/jq/…) plus
 * the `voidhash` custom command. Custom commands register in
 * {@link workspaceCustomCommands}.
 */
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import { runPromise } from "../../runtime-boundary.ts";
import { Bash, defineCommand, type CustomCommand, type ExecResult } from "just-bash/browser";

import {
  makeWorkspaceVfs,
  WORKSPACE_VFS_README,
  type WorkspaceVfsSources,
} from "./workspace-vfs.ts";
import * as Arr from "effect/Array";
import * as Schema from "effect/Schema";

/** stdout cap for one bash result (~10k tokens). */
export const MAX_BASH_STDOUT = 40_000;
/** stderr cap for one bash result. */
export const MAX_BASH_STDERR = 8_000;

const paywallListing = (lines: ReadonlyArray<string>): string => {
  if (Arr.isReadonlyArrayEmpty(lines)) return "";
  return `${lines.join("\n")}\n`;
};

const voidhashResult = (
  sources: WorkspaceVfsSources,
  args: ReadonlyArray<string>,
): Effect.Effect<ExecResult, unknown> =>
  Effect.gen(function* () {
    const subcommand = args[0];
    if (subcommand === undefined || subcommand === "help") {
      return { stdout: WORKSPACE_VFS_README, stderr: "", exitCode: 0 };
    }
    if (subcommand === "paywalls") {
      const paywalls = yield* Effect.tryPromise({
        try: () => sources.listPaywalls(),
        catch: (cause) => cause,
      });
      const lines = paywalls.map((paywall) => `${paywall.paywallId}\t${paywall.slug}`);
      return { stdout: paywallListing(lines), stderr: "", exitCode: 0 };
    }
    return {
      stdout: "",
      stderr: `voidhash: unknown subcommand '${subcommand}' (usage: voidhash [help|paywalls])\n`,
      exitCode: 1,
    };
  });

const voidhashCommand = (sources: WorkspaceVfsSources): CustomCommand =>
  defineCommand("voidhash", (args) => runPromise(voidhashResult(sources, args)));

const workspaceCustomCommands = (sources: WorkspaceVfsSources): CustomCommand[] => [
  voidhashCommand(sources),
];

// Filesystem errors from redirect targets (`echo x > /paywalls/...`) escape
// the interpreter as throws instead of becoming command stderr; a Node-shaped
// `E<CODE>:` message is an answered question, not an infrastructure failure.
const isFsError = (error: unknown): error is Error =>
  P.isError(error) && /^E[A-Z]+: /.test(error.message);

const execOptions = (
  signal: AbortSignal | typeof Schema.Undefined.Type,
): { signal?: AbortSignal } => {
  if (signal === undefined) return {};
  return { signal };
};

const workspaceBashResult = (
  sources: WorkspaceVfsSources,
  command: string,
  signal: AbortSignal | typeof Schema.Undefined.Type,
): Effect.Effect<ExecResult, unknown> =>
  Effect.gen(function* () {
    const fs = yield* Effect.tryPromise({
      try: () => makeWorkspaceVfs(sources),
      catch: (cause) => cause,
    });
    const bash = new Bash({
      fs,
      cwd: "/",
      env: { HOME: "/home/user" },
      executionLimits: {
        maxCommandCount: 512,
        maxOutputSize: 2 * 1024 * 1024,
      },
      customCommands: workspaceCustomCommands(sources),
    });
    return yield* Effect.tryPromise({
      try: () => bash.exec(command, execOptions(signal)),
      catch: (cause) => cause,
    }).pipe(
      Effect.catchIf(isFsError, (error) =>
        Effect.succeed({ stdout: "", stderr: `bash: ${error.message}\n`, exitCode: 1 }),
      ),
    );
  });

/**
 * Execute one command line in a fresh workspace shell. Filesystem and shell
 * state live only for this call; `signal` cooperatively aborts execution.
 */
export const runWorkspaceBash = (
  sources: WorkspaceVfsSources,
  command: string,
  options: { readonly signal?: AbortSignal } = {},
): Promise<ExecResult> => runPromise(workspaceBashResult(sources, command, options.signal));

const truncate = (text: string, max: number, label: string): string => {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n[${label} truncated at ${Math.round(max / 1000)}kB — narrow with grep/head/wc and rerun]\n`;
};

/** Cap a bash result's streams to token-friendly sizes, appending a notice. */
export const truncateBashOutput = (
  result: Pick<ExecResult, "stdout" | "stderr">,
): { stdout: string; stderr: string } => ({
  stdout: truncate(result.stdout, MAX_BASH_STDOUT, "stdout"),
  stderr: truncate(result.stderr, MAX_BASH_STDERR, "stderr"),
});
