import { Flag } from "effect/unstable/cli";

/**
 * Shared debug option for all commands.
 * The actual debug behavior is handled by isDebugMode() in error-formatter.ts
 * which checks process.argv directly. This option just tells the parser to accept it.
 */
export const debugOption = Flag.boolean("debug").pipe(
  Flag.withAlias("d"),
  Flag.withDescription("Enable debug logging with full error traces"),
  Flag.withDefault(false)
);
