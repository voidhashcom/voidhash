import { Flag } from "effect/unstable/cli";

/**
 * Shared debug option for all commands.
 * The actual debug behavior is handled by isDebugMode() in error-formatter.ts
 * which checks process.argv directly. This option just tells the parser to accept it.
 */
export const debugOption = Flag.boolean("debug").pipe(
  Flag.withAlias("d"),
  Flag.withDescription("Enable debug logging with full error traces"),
  Flag.withDefault(false),
);

/**
 * Shared profile option for all commands.
 * Selects a named set of config overrides merged onto the shared base config.
 * The active profile is resolved from process.argv by getActiveProfile() in
 * error-formatter.ts; this option just tells the parser to accept it.
 *
 * No short alias: `-p` is already used by the `studio` command for `--port`.
 */
export const profileOption = Flag.string("profile").pipe(
  Flag.withDescription("Use a named config profile (overrides merged onto the base config)"),
  Flag.withDefault(""),
);
