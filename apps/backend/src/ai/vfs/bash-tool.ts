/**
 * The just-bash execution seam behind the `bash` workspace tool: a fresh,
 * sandboxed shell per invocation over {@link makeWorkspaceVfs}. No network, no
 * script runtimes — the default pure-JS command set (grep/sed/awk/jq/…) plus
 * the `voidhash` custom command. Custom commands register in
 * {@link workspaceCustomCommands}.
 */
import { Bash, defineCommand, type CustomCommand, type ExecResult } from "just-bash/browser";

import {
  makeWorkspaceVfs,
  WORKSPACE_VFS_README,
  type WorkspaceVfsSources,
} from "./workspace-vfs.ts";

/** stdout cap for one bash result (~10k tokens). */
export const MAX_BASH_STDOUT = 40_000;
/** stderr cap for one bash result. */
export const MAX_BASH_STDERR = 8_000;

const voidhashCommand = (sources: WorkspaceVfsSources): CustomCommand =>
  defineCommand("voidhash", async (args) => {
    const subcommand = args[0];
    if (subcommand === undefined || subcommand === "help") {
      return { stdout: WORKSPACE_VFS_README, stderr: "", exitCode: 0 };
    }
    if (subcommand === "paywalls") {
      const paywalls = await sources.listPaywalls();
      const lines = paywalls.map((paywall) => `${paywall.paywallId}\t${paywall.slug}`);
      return { stdout: lines.length === 0 ? "" : `${lines.join("\n")}\n`, stderr: "", exitCode: 0 };
    }
    return {
      stdout: "",
      stderr: `voidhash: unknown subcommand '${subcommand}' (usage: voidhash [help|paywalls])\n`,
      exitCode: 1,
    };
  });

const workspaceCustomCommands = (sources: WorkspaceVfsSources): CustomCommand[] => [
  voidhashCommand(sources),
];

// Filesystem errors from redirect targets (`echo x > /paywalls/...`) escape
// the interpreter as throws instead of becoming command stderr; a Node-shaped
// `E<CODE>:` message is an answered question, not an infrastructure failure.
const isFsError = (error: unknown): error is Error =>
  error instanceof Error && /^E[A-Z]+: /.test(error.message);

/**
 * Execute one command line in a fresh workspace shell. Filesystem and shell
 * state live only for this call; `signal` cooperatively aborts execution.
 */
export const runWorkspaceBash = async (
  sources: WorkspaceVfsSources,
  command: string,
  options: { readonly signal?: AbortSignal } = {},
): Promise<ExecResult> => {
  const bash = new Bash({
    fs: await makeWorkspaceVfs(sources),
    cwd: "/",
    env: { HOME: "/home/user" },
    executionLimits: {
      maxCommandCount: 512,
      maxOutputSize: 2 * 1024 * 1024,
    },
    customCommands: workspaceCustomCommands(sources),
  });
  try {
    return await bash.exec(command, options.signal === undefined ? {} : { signal: options.signal });
  } catch (error) {
    if (isFsError(error)) {
      return { stdout: "", stderr: `bash: ${error.message}\n`, exitCode: 1 };
    }
    throw error;
  }
};

const truncate = (text: string, max: number, label: string): string =>
  text.length <= max
    ? text
    : `${text.slice(0, max)}\n[${label} truncated at ${Math.round(max / 1000)}kB — narrow with grep/head/wc and rerun]\n`;

/** Cap a bash result's streams to token-friendly sizes, appending a notice. */
export const truncateBashOutput = (
  result: Pick<ExecResult, "stdout" | "stderr">,
): { stdout: string; stderr: string } => ({
  stdout: truncate(result.stdout, MAX_BASH_STDOUT, "stdout"),
  stderr: truncate(result.stderr, MAX_BASH_STDERR, "stderr"),
});
