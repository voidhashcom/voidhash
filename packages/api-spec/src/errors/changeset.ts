import { Schema } from "effect";

/** Generic changeset deployment service error */
export class ChangesetDeploymentServiceError extends Schema.TaggedErrorClass<ChangesetDeploymentServiceError>()(
  "ChangesetDeploymentServiceError",
  {
    cause: Schema.Unknown,
  },
  { httpApiStatus: 500 }
) {}
