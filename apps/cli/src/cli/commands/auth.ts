import { Command } from "effect/unstable/cli";
import * as Effect from "effect/Effect";

import { loginCommand } from "./auth-login";
import { logoutCommand } from "./auth-logout";
import { authStatusCommand } from "./auth-status";
import { authTokenCommand } from "./auth-token";

export const authCommand = Command.make("auth", {}, () =>
  Effect.gen(function* authCommand() {
    // TODO: Show sucommands documentation
  }),
).pipe(
  Command.withDescription("Manage the Voidhash authentication."),
  Command.withSubcommands([loginCommand, logoutCommand, authStatusCommand, authTokenCommand]),
);
