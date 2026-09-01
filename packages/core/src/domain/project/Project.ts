/**
 * Project domain — typed errors that signal a project invariant violation.
 * Row data lives in the `projects` Drizzle table.
 */
import * as Schema from "effect/Schema";

/** Project row not found in the database. */
export class ProjectNotFoundError extends Schema.TaggedErrorClass<ProjectNotFoundError>(
  "ProjectNotFoundError",
)("ProjectNotFoundError", { projectId: Schema.String }) {}
