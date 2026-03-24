import { Schema } from "effect";

/** Generic project service error */
export class ProjectServiceError extends Schema.TaggedErrorClass<ProjectServiceError>()(
  "ProjectServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 }
) {}

/** Project not found */
export class ProjectNotFoundError extends Schema.TaggedErrorClass<ProjectNotFoundError>()(
  "ProjectNotFoundError",
  {
    projectId: Schema.String,
  },
  { httpApiStatus: 404 }
) {
  override toString(): string {
    return `The following project not found: ${this.projectId}`;
  }
}
