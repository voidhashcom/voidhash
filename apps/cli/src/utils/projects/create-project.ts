import { Prompt } from '@effect/cli';
import { Console, Effect } from 'effect';
import { NoSignedInUserError } from '../../domain/errors/auth';
import { CliConfig } from '../../domain/services/cli-config';
import { ApiClient } from '../api-client';

const validateProjectName = (value: string) => {
  if (value.length < 3) {
    return Effect.fail('Project name must be at least 3 characters');
  }
  if (value.length > 32) {
    return Effect.fail('Project name must be less than 32 characters');
  }
  return Effect.succeed(value);
};

export const createProject = (input: { organizationId: string }) =>
  Effect.gen(function* () {
    const client = yield* ApiClient;
    const cliConfig = yield* CliConfig;

    const config = yield* cliConfig.readConfig().pipe(
      Effect.catchTag('ConfigFileNotFoundError', () => Effect.succeed(null)),
      Effect.catchAll(() => Effect.dieMessage('Failed to read config'))
    );

    // If the config file is not found or the api key is not set, we consider the user to be signed out
    const apiKey = config?.apiKey;
    if (!apiKey) {
      yield* Effect.logInfo(
        'Api key is not set, considering the user to be signed out'
      );
      return yield* Effect.fail(
        new NoSignedInUserError({ message: 'No signed in user' })
      );
    }

    const attemptToCreateProject = Effect.gen(function* () {
      const name = yield* Prompt.run(
        Prompt.text({
          message: 'Enter a name for the project',
          validate: (value) => validateProjectName(value)
        })
      );

      const project = yield* client.v1_projects.createProject({
        headers: {
          'x-api-key': apiKey
        },
        payload: {
          name,
          organizationId: input.organizationId
        }
      });

      yield* Console.log(`Successfully created project ${project.name}`);

      return project;
    });

    return yield* attemptToCreateProject;
  });
