import { Activity, Workflow } from '@effect/workflow';
import {
  AuthSession,
  AuthSessionSchema,
  ChangesetSchema,
  sortChangeset
} from '@voidhash/shared';
import { Effect, Schema } from 'effect';
import { PerkService } from '../../perks';

class DeployChangesetError extends Schema.TaggedError<DeployChangesetError>(
  'DeployChangesetError'
)('DeployChangesetError', {
  message: Schema.String
}) {}

export const DeployChangesetWorkflow = Workflow.make({
  // Every workflow needs a unique name
  name: 'DeployChangesetWorkflow',
  // Add a success schema. You can omit this to use the default value `Schema.Void`
  success: Schema.Void,
  // Add an error schema. You can omit this to use the default value `Schema.Never`
  error: DeployChangesetError,
  // Define the payload for the workflow
  payload: {
    deploymentId: Schema.String,
    projectId: Schema.String,
    changeset: ChangesetSchema,
    authSession: AuthSessionSchema
  },
  // Define the idempotency key for the workflow. This is used to ensure that
  // the workflow is not duplicated if it is retried.
  idempotencyKey: ({ deploymentId }) => deploymentId
});

export const DeployChangesetWorkflowLayer = DeployChangesetWorkflow.toLayer(
  Effect.fn(function* (payload) {
    const perkService = yield* PerkService;
    const projectId = payload.projectId;
    /**
    TODO:
    - Deploy perks
    - Deploy products / subscriptions
    - Deploy payment provider products
    - Deploy payment provider perks
    */

    // Sort the changeset to ensure that dependant changes are deployed after the changes they depend on.
    const sortedChangeset = sortChangeset(payload.changeset);

    // Deploy perks
    for (const change of sortedChangeset) {
      switch (change.changeType) {
        case 'create-perk':
          yield* Activity.make({
            name: `DeployChange-${change.changeType}-${change.key}`,
            success: Schema.Struct({
              id: Schema.String
            }),
            error: DeployChangesetError,
            execute: Effect.gen(function* () {
              // You can access the current attempt number of the activity.
              return yield* perkService
                .createPerk({
                  ...change.payload,
                  projectId
                })
                .pipe(
                  Effect.provideService(AuthSession, payload.authSession),
                  Effect.catchTags({
                    PerkSlugAlreadyExistsError: () => {
                      return Effect.fail(
                        new DeployChangesetError({
                          message: `Perk slug ${change.payload.slug} already exists for project ${projectId}`
                        })
                      );
                    },
                    ActionForbiddenError: () => {
                      return Effect.fail(
                        new DeployChangesetError({
                          message: `User is not authorized to create perks for project ${projectId}`
                        })
                      );
                    },
                    PerkServiceError: (error) =>
                      new DeployChangesetError({
                        message: `Failed to create perk ${change.key} for project ${projectId}: ${error.message}`
                      })
                  })
                );
            })
          }).pipe(
            Activity.retry({ times: 3 }),
            DeployChangesetWorkflow.withCompensation(
              Effect.fn(function* (result) {
                yield* perkService
                  .deletePerk({
                    perkId: result.id
                  })
                  .pipe(
                    Effect.provideService(AuthSession, payload.authSession),
                    Effect.catchAll((error) => Effect.logError(error))
                  );
              })
            )
          );
          break;
      }
    }
  })
);
