import { HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";

/** Generic project service error */
export class ProjectServiceError extends Schema.TaggedError<ProjectServiceError>()(
  "ProjectServiceError",
  {
    cause: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}

/** Project not found */
export class ProjectNotFoundError extends Schema.TaggedError<ProjectNotFoundError>()(
  "ProjectNotFoundError",
  {
    projectId: Schema.String,
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  toString(): string {
    return `The following project not found: ${this.projectId}`;
  }
}
