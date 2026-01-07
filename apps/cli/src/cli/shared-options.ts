import { Options } from "@effect/cli";

/**
 * Shared debug option for all commands.
 * The actual debug behavior is handled by isDebugMode() in error-formatter.ts
 * which checks process.argv directly. This option just tells the parser to accept it.
 */
export const debugOption = Options.boolean("debug").pipe(
  Options.withAlias("d"),
  Options.withDescription("Enable debug logging with full error traces"),
  Options.withDefault(false)
);
