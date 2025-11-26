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

    const attemptToCreateOrganization = Effect.gen(function* () {
      const name = yield* Prompt.run(
        Prompt.text({
          message: 'Enter a name for the organization',
          validate: (value) => validateOrganizationName(value)
        })
      );

      const organization = yield* client.organizations.createOrganization({
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
