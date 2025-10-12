import { Prompt } from '@effect/cli';
import { Console, Effect } from 'effect';
import { NoSignedInUserError } from '../../domain/errors/auth';
import { CliConfig } from '../../domain/services/cli-config';
import { ApiClient } from '../api-client';

const validateOrganizationName = (value: string) => {
  if (value.length < 3) {
    return Effect.fail('Organization name must be at least 3 characters');
  }
  if (value.length > 32) {
    return Effect.fail('Organization name must be less than 32 characters');
  }
  return Effect.succeed(value);
};

export const createOrganization = () =>
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

    const attemptToCreateOrganization = Effect.gen(function* () {
      const name = yield* Prompt.run(
        Prompt.text({
          message: 'Enter a name for the organization',
          validate: (value) => validateOrganizationName(value)
        })
      );

      const organization = yield* client.v1_organizations.createOrganization({
        headers: {
          'x-api-key': apiKey
        },
        payload: {
          name
        }
      });

      yield* Console.log(
        `Successfully created organization ${organization.name}`
      );

      return organization;
    });

    return yield* attemptToCreateOrganization;
  });
