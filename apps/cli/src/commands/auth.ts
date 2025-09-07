import { Command } from '@effect/cli';
import { Effect } from 'effect';
import { loginCommand } from './auth-login';
import { logoutCommand } from './auth-logout';
import { authStatusCommand } from './auth-status';

export const authCommand = Command.make('auth', {}, () =>
  Effect.gen(function* () {
    // TODO: Show sucommands documentation
  })
).pipe(
  Command.withDescription('Manage the Voidhash authentication.'),
  Command.withSubcommands([loginCommand, logoutCommand, authStatusCommand])
);
