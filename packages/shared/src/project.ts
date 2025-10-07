import { Schema } from 'effect';

export class ProjectServiceError extends Schema.TaggedError<ProjectServiceError>()(
  'ProjectServiceError',
  {
    cause: Schema.String
  }
) {}

export class ProjectNotFoundError extends Schema.TaggedError<ProjectNotFoundError>()(
  'ProjectNotFoundError',
  {
    projectId: Schema.String
  }
) {
  toString(): string {
    return `The following project not found: ${this.projectId}`;
  }
}
