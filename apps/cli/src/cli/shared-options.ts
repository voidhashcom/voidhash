import { Flag } from "effect/cli";

/**
 * Shared debug option for all commands.
 * The actual debug behavior is handled by isDebugMode() in error-formatter.ts
 * which checks process.argv directly. This option just tells the parser to accept it.
 */
export const debugOption = Flag.Boolean("debug").pipe(
  Flag.withAlias("d"),
  Flag.withDescription("Enable debug logging with full error traces"),
  Flag.withDefault(false),
);

/**
 * The project a project-scoped command acts on, for this run. Pass its value
 * to `resolveProject`, which also decides without it (see `context.ts`).
 */
export const projectOption = Flag.String("project").pipe(
  Flag.withDescription(
    "Project to act on: its id, slug, organization/slug or name (default: this directory's project, then your default project)",
  ),
  Flag.optional,
);

/**
 * `--json` and `-q`/`--quiet` for a command that prints API objects. Spread
 * them into the command's flags and pass both to `outputModeOf`.
 */
export const outputOptions = {
  json: Flag.Boolean("json").pipe(
    Flag.withDescription("Print the API objects as JSON, for scripts"),
    Flag.withDefault(false),
  ),
  quiet: Flag.Boolean("quiet").pipe(
    Flag.withAlias("q"),
    Flag.withDescription("Print only ids, one per line"),
    Flag.withDefault(false),
  ),
};

/** `-y`/`--yes` for a command that confirms before a change that cannot be undone. */
export const yesOption = Flag.Boolean("yes").pipe(
  Flag.withAlias("y"),
  Flag.withDescription("Make the change without asking for confirmation"),
  Flag.withDefault(false),
);

/** `--dry-run` for a command whose changes can be shown before they are made. */
export const dryRunOption = Flag.Boolean("dry-run").pipe(
  Flag.withDescription("Show what would change, and change nothing"),
  Flag.withDefault(false),
);

/**
 * Shared profile option for all commands.
 * Selects a named set of config overrides merged onto the shared base config.
 * The active profile is resolved from process.argv by getActiveProfile() in
 * error-formatter.ts, falling back to VOIDHASH_PROFILE; this option just tells
 * the parser to accept it.
 *
 * No short alias: `-p` is already used by the `studio` command for `--port`.
 */
export const profileOption = Flag.String("profile").pipe(
  Flag.withDescription("Use a named config profile (overrides merged onto the base config)"),
  Flag.withDefault(""),
);
