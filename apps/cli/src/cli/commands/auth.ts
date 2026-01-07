import { Command } from "@effect/cli";
import { Effect } from "effect";

import { debugOption } from "../shared-options";
import { loginCommand } from "./auth-login";
import { logoutCommand } from "./auth-logout";
import { authStatusCommand } from "./auth-status";

export const authCommand = Command.make("auth", { debug: debugOption }, () =>
  Effect.gen(function* authCommand() {
    // TODO: Show sucommands documentation
  })
).pipe(
  Command.withDescription("Manage the Voidhash authentication."),
  Command.withSubcommands([loginCommand, logoutCommand, authStatusCommand])
);
