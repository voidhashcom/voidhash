import { Prompt } from '@effect/cli';
import { Effect } from 'effect';

export const createProject = (input: { organizationId: string }) =>
  Effect.gen(function* () {
    yield* Prompt.run(Prompt.text({ message: 'Enter a name for the project' }));
    return yield* Effect.dieMessage('Creating project not implemented yet.');
  });
