import { Command } from "effect/cli";

import { outputOptions } from "../shared-options";
import { showSession } from "./whoami";

/** `voidhash-cli auth status [--json]`: the same as `voidhash-cli whoami`. */
export const authStatusCommand = Command.make("status", { json: outputOptions.json }, ({ json }) =>
  showSession(json),
).pipe(Command.withDescription("Show who the CLI is signed in as (the same as 'whoami')."));
