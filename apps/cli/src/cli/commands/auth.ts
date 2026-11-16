import { Command } from "effect/cli";

import { loginCommand } from "./auth-login";
import { logoutCommand } from "./auth-logout";
import { authStatusCommand } from "./auth-status";

/** `voidhash-cli auth …`; `login`, `logout` and `whoami` are also top-level commands. */
export const authCommand = Command.make("auth").pipe(
  Command.withDescription("Sign the CLI in and out, and see who it is signed in as."),
  Command.withSubcommands([loginCommand, logoutCommand, authStatusCommand]),
);
