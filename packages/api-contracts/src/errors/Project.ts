import * as Schema from "effect/Schema";

/** Generic project service error */
export class ApiProjectServiceError extends Schema.TaggedErrorClass<ApiProjectServiceError>()(
  "Api/ProjectServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/** Project not found */
export class ApiProjectNotFoundError extends Schema.TaggedErrorClass<ApiProjectNotFoundError>()(
  "Api/ProjectNotFoundError",
  {
    projectId: Schema.String,
  },
  { httpApiStatus: 404 },
) {
  override toString(): string {
    return `The following project not found: ${this.projectId}`;
  }
}
