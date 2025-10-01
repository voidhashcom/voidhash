import { Command, HelpDoc, Prompt, ValidationError } from '@effect/cli';
import { Console, Effect } from 'effect';
import { getSignedInSession } from '../../utils/login/get-signed-in-user';
import { login } from '../../utils/login/login';
import { selectOrganization } from '../../utils/organizations/select-organization';
import { selectProject } from '../../utils/projects/select-project';
import { loadVoidhashConfig } from '../../utils/source-code/voidhash-config';

export const initCommand = Command.make('init', {}, () =>
  Effect.gen(function* () {
    const voidhashConfig = yield* loadVoidhashConfig().pipe(
      Effect.catchTag('VoidhashConfigNotFoundError', () => Effect.succeed(null))
    );

    if (voidhashConfig) {
      return yield* Effect.fail(
        ValidationError.invalidValue(
          HelpDoc.p(
            'Voidhash was already initialized in this project. If you want to re-initialize, please remove the voidhash.config.(ts|js|cjs|mjs) file and run the command again.'
          )
        )
      );
    }

    // Sign in
    const session = yield* getSignedInSession
      .pipe(
        Effect.catchTag('NoSignedInUserError', () =>
          Effect.gen(function* () {
            const shouldContinue = yield* Prompt.run(
              Prompt.confirm({
                message:
                  'You are not logged in. In the next step, we will open a browser window to sign you in. Do you want to continue?'
              })
            );
            if (!shouldContinue) {
              return yield* Effect.fail(
                ValidationError.invalidValue(HelpDoc.p('Login cancelled.'))
              );
            }
            return yield* login.pipe(Effect.andThen(getSignedInSession));
          })
        )
      )
      .pipe(
        Effect.catchTags({
          NoSignedInUserError: () =>
            Effect.fail(
              ValidationError.invalidValue(
                HelpDoc.p('We were unable to sign you in. Please try it again.')
              )
            )
          // TODO: handle other errors
        })
      );

    // Select team
    const organization = yield* selectOrganization(session.organizations);

    // Select project
    const project = yield* selectProject(organization.id, session.projects);

    yield* Console.log(organization, project);

    yield* Console.log(`Logged in as ${session?.name}`);

    // const sourceCodeDetails = yield* retrieveSourceCodeDetails();
  })
).pipe(Command.withDescription('Initialize a new Voidhash project.'));
