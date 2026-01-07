import { Effect } from "effect";

import { deployChangeset } from "./deploy-changeset";
import { DeployChangesetWorkflowLayer } from "./workflows/deploy-changeset-workflow";

export class ChangesetDeploymentService extends Effect.Service<ChangesetDeploymentService>()(
  "ChangesetDeploymentService",
  {
    dependencies: [DeployChangesetWorkflowLayer],
    effect: Effect.gen(function* effect() {
      return {
        deployChangeset: yield* deployChangeset,
      } as const;
    }),
  }
) {}
