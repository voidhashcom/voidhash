import { Effect } from "effect";

import { createProject } from "./create-project";
import { deleteProject } from "./delete-project";
import { getProjectById } from "./get-project-by-id";
import { getProjectBySlug } from "./get-project-by-slug";
import { getProjectBySlugAndOrganizationSlug } from "./get-project-by-slug-and-organization-slug";
import { getProjects } from "./get-projects";
import { getProjectsByOrganizationSlug } from "./get-projects-by-organization-slug";
import { updateProject } from "./update-project";

export class ProjectService extends Effect.Service<ProjectService>()(
  "ProjectService",
  {
    dependencies: [],
    effect: Effect.gen(function* effect() {
      return {
        createProject: yield* createProject,
        deleteProject: yield* deleteProject,
        getProjectById: yield* getProjectById,
        getProjectBySlug: yield* getProjectBySlug,
        getProjectBySlugAndOrganizationSlug:
          yield* getProjectBySlugAndOrganizationSlug,
        getProjects: yield* getProjects,
        getProjectsByOrganizationSlug: yield* getProjectsByOrganizationSlug,
        updateProject: yield* updateProject,
      } as const;
    }),
  }
) {}
