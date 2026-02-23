import { HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";

/** Generic changeset deployment service error */
export class ChangesetDeploymentServiceError extends Schema.TaggedError<ChangesetDeploymentServiceError>()(
  "ChangesetDeploymentServiceError",
  {
    cause: Schema.Unknown,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}
