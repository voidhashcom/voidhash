import { AuthSession } from "@/lib/effect/auth";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { Data, Effect, pipe, Schema } from "effect";
import { ProjectRepository } from "../project.repository";

export class ProjectNotFound extends Data.TaggedError("ProjectNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const deleteProjectInputSchema = Schema.Struct({
	id: Schema.String,
});

type DeleteProjectInput = Schema.Schema.Type<typeof deleteProjectInputSchema>;

export const deleteProject = (inputUnsafe: DeleteProjectInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const projectRepository = yield* ProjectRepository;
			const input = Schema.decodeUnknownSync(deleteProjectInputSchema)(
				inputUnsafe
			);

			// First check if project exists
			const project = yield* projectRepository.getProjectById(input.id);
			if (!project) {
				return yield* Effect.fail(
					new ProjectNotFound({
						message: `Project ${input.id} not found`,
					})
				);
			}

			// SECURITY: Authorization check
			yield* checkProjectPermission(
				input.id,
				"project:all",
				`User ${session?.user?.id} is not authorized to delete project ${input.id}`
			);

			// Delete the project
			yield* projectRepository.deleteProject(input.id);

			yield* Effect.log(`Deleted project ${input.id}`);

			return yield* Effect.succeed(undefined);
		}),
		AuthSession.withAuthSession()
	);
