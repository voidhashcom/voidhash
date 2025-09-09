import { Console, Effect } from 'effect';
import { readConfig } from '../config/read-config';
import { writeToConfig } from '../config/write-to-config';

export const logout = Effect.gen(function* () {
  const config = yield* readConfig();
  if (!config.apiKey) {
    yield* Console.log('You are not logged in.');
    return;
  }

  yield* writeToConfig({ apiKey: null });
  yield* Console.log('You have been logged out.');
});
