import { ChangesetDeploymentStatus, changesetDeployments } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import {
  AuthSession,
  ChangesetDeploymentServiceError,
  type ChangesetSchema
} from '@voidhash/shared';
import { Effect } from 'effect';
import { DeployChangesetWorkflow } from './workflows/deploy-changeset-workflow';

const _createChangesetDeploymentRecord = (db: Db) =>
  db.makeQuery(
    (
      execute,
      input: {
        id: string;
        projectId: string;
        changeset: typeof ChangesetSchema.Type;
      }
    ) =>
      execute(
        async (db) =>
          await db.insert(changesetDeployments).values({
            id: input.id,
            projectId: input.projectId,
            changeset: input.changeset,
            status: ChangesetDeploymentStatus.Pending
          })
      )
  );

export const deployChangeset = Effect.gen(function* () {
  const db = yield* Db;
  return Effect.fn('deployChangeset')(
    function* (input: {
      projectId: string;
      changeset: typeof ChangesetSchema.Type;
    }) {
      const authSession = yield* AuthSession;
      // TODO: There should be a check to see if the deployment already exists to prevent multiple deployments simultaneously.
      const deploymentId = generateId('changesetDeployment');
      yield* _createChangesetDeploymentRecord(db)({
        id: deploymentId,
        projectId: input.projectId,
        changeset: input.changeset
      });

      yield* DeployChangesetWorkflow.execute({
        deploymentId,
        projectId: input.projectId,
        changeset: input.changeset,
        authSession
      });

      return {
        id: deploymentId
      };
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DeployChangesetError: (error) =>
            new ChangesetDeploymentServiceError({
              cause: error.message
            })
        })
      )
  );
});
