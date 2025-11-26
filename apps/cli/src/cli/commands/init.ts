import { Command, HelpDoc, Prompt, ValidationError } from '@effect/cli';
import { Path } from '@effect/platform';
import { Console, Effect } from 'effect';
import { Auth } from '../../domain/services/auth';
import { Codegen } from '../../domain/services/codegen';
import { SourceCode } from '../../domain/services/source-code';
import { assertFileCanBeCreated } from '../../utils/fs';
import { selectOrganization } from '../../utils/organizations/select-organization';
import { selectProject } from '../../utils/projects/select-project';

export const initCommand = Command.make('init', {}, () =>
  Effect.gen(function* () {
    const auth = yield* Auth;
    const sourceCode = yield* SourceCode;
    const codegen = yield* Codegen;
    const path = yield* Path.Path;

    const voidhashConfig = yield* sourceCode
      .loadVoidhashConfig()
      .pipe(
        Effect.catchTag('VoidhashConfigNotFoundError', () =>
          Effect.succeed(null)
        )
      );

    if (voidhashConfig) {
      const shouldContinue = yield* Prompt.run(
        Prompt.confirm({
          message:
            'Voidhash was already initialized in this project. This will overwrite the existing configuration. Do you want to continue?'
        })
      );
      if (!shouldContinue) {
        return yield* Console.log('Initialization cancelled.');
      }
      yield* sourceCode.deleteVoidhashConfig();
    }

    // Sign in
    const session = yield* auth.getSignedInSession
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
            return yield* auth.login.pipe(
              Effect.andThen(auth.getSignedInSession)
            );
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
            ),
          FailedToGetSessionError: (e) =>
            Effect.fail(
              ValidationError.invalidValue(
                HelpDoc.p('Failed to get user session. Please try again.')
              )
            ).pipe(Effect.tapError(() => Effect.logDebug(e)))
          // TODO: handle other errors
        })
      );

    // Select team
    const organization = yield* selectOrganization(session.organizations);

    // Select project
    const project = yield* selectProject(
      organization.id,
      session.projects.filter((p) => p.organizationId === organization.id)
    );

    // Select folder path

    const srcFolderPath = yield* sourceCode.retrieveSrcDir();
    const hasSrcDir = srcFolderPath.endsWith('src');

    const voidhashFilesFolderPath = yield* Prompt.run(
      Prompt.text({
        message:
          'Select the folder where you want to create the Voidhash schema and client',
        default: hasSrcDir ? './src/utils/voidhash' : './utils/voidhash'
      })
    );

    // File names
    const language = yield* sourceCode.detectSrcLanguage();
    const schemaFileName = language === 'ts' ? 'schema.ts' : 'schema.js';
    const clientFileName = language === 'ts' ? 'client.ts' : 'client.js';
    const configFileName =
      language === 'ts' ? 'voidhash.config.ts' : 'voidhash.config.js';

    // File paths
    const schemaFilePath = path.resolve(
      voidhashFilesFolderPath,
      schemaFileName
    );
    const clientFilePath = path.resolve(
      voidhashFilesFolderPath,
      clientFileName
    );
    const configFilePath = path.resolve(configFileName);

    yield* Console.log(schemaFilePath, clientFilePath, configFilePath);

    // Assert files can be created
    yield* assertFileCanBeCreated(schemaFileName, schemaFilePath);
    yield* assertFileCanBeCreated(clientFileName, clientFilePath);
    yield* assertFileCanBeCreated(configFileName, configFilePath);

    // Generate files
    // yield* codegen.generateSchemaFile(schemaFilePath);
    // yield* codegen.generateClientFile(clientFilePath);
    yield* codegen.generateVoidhashConfigFile(configFilePath, {
      team: organization.slug,
      project: project.slug,
      schema: path.relative(path.resolve(), schemaFilePath)
    });

    // Generate voidhash.config.ts, voidhash client and schema

    // const sourceCodeDetails = yield* retrieveSourceCodeDetails();
  })
).pipe(Command.withDescription('Initialize a new Voidhash project.'));
