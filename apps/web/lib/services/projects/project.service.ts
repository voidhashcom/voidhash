import { Effect, pipe } from "effect";
import { ProjectRepository } from "./project.repository";
import { AuthSession } from "@/lib/effect/auth";
import { createProject } from "./actions/create-project";
import { deleteProject } from "./actions/delete-project";
import { updateProject } from "./actions/update-project";
import {
	checkProjectPermission,
	checkOrganizationPermission,
} from "@/lib/effect/permissions";
import { OrganizationRepository } from "../organizations/organization.repository";

export class ProjectService extends Effect.Service<ProjectService>()(
	"ProjectService",
	{
		effect: Effect.gen(function* () {
			const projectRepository = yield* ProjectRepository;
			return {
				createProject,
				getProjects: (organizationId: string) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;

							// SECURITY: Authorization check
							yield* checkOrganizationPermission(
								organizationId,
								"organization:all",
								`User ${session?.user?.id} is not authorized to access projects for organization ${organizationId}`
							);

							return yield* projectRepository.getProjects(organizationId);
						}),
						AuthSession.withAuthSession()
					),
				getProjectById: (id: string) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const project = yield* projectRepository.getProjectById(id);
							if (!project) return null;

							// SECURITY: Authorization check
							yield* checkProjectPermission(
								id,
								"project:all",
								`User ${session?.user?.id} is not authorized to access project ${id}`
							);

							return project;
						}),
						AuthSession.withAuthSession()
					),
				getProjectBySlug: ({
					organizationId,
					slug,
				}: {
					organizationId: string;
					slug: string;
				}) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;

							const project = yield* projectRepository.getProjectBySlug({
								projectSlug: slug,
								organizationId,
							});

							if (!project) return null;

							// SECURITY: Authorization check for project
							yield* checkProjectPermission(
								project.id,
								"project:all",
								`User ${session?.user?.id} is not authorized to access project ${project.id}`
							);

							return project;
						}),
						AuthSession.withAuthSession()
					),
				getProjectBySlugAndOrganizationSlug: ({
					organizationSlug,
					projectSlug,
				}: {
					organizationSlug: string;
					projectSlug: string;
				}) => pipe(Effect.gen(function* () {
                    const session = yield* AuthSession;
                    const organizationRepository = yield* OrganizationRepository;
                    const organization = yield* organizationRepository.getOrganizationBySlug(organizationSlug);
                    if (!organization) return null;

                    const project = yield* projectRepository.getProjectBySlug({
                        projectSlug,
                        organizationId: organization.id,
                    });

                    if (!project) return null;

                    // SECURITY: Authorization check for project
                    yield* checkProjectPermission(project.id, "project:all", `User ${session?.user?.id} is not authorized to access project ${project.id}`);

                    return project;
                }),
                AuthSession.withAuthSession()
            ),
            getProjectsByOrganizationSlug: (organizationSlug: string) => pipe(Effect.gen(function* () {
                const session = yield* AuthSession;
                const organizationRepository = yield* OrganizationRepository;
                const organization = yield* organizationRepository.getOrganizationBySlug(organizationSlug);
                if (!organization) return null;

                // SECURITY: Authorization check for organization
                yield* checkOrganizationPermission(organization.id, "organization:all", `User ${session?.user?.id} is not authorized to access organization ${organization.id}`);

                return yield* projectRepository.getProjects(organization.id);
            }), AuthSession.withAuthSession()),

				updateProject,
				deleteProject,
			};
		}),

		// Specify dependencies
		dependencies: [ProjectRepository.Default],
	}
) {}
