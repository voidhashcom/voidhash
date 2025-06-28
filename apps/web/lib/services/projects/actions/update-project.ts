import { AuthSession } from "@/lib/effect/auth";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { Data, Effect, pipe, Schema } from "effect";
import { ProjectRepository } from "../project-repository";

export class ProjectNotFound extends Data.TaggedError("ProjectNotFound")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export const updateProjectInputSchema = Schema.Struct({
	id: Schema.String,
	name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(32)),
});

type UpdateProjectInput = Schema.Schema.Type<typeof updateProjectInputSchema>;

export const updateProject = (inputUnsafe: UpdateProjectInput) =>
	pipe(
		Effect.gen(function* () {
			const session = yield* AuthSession;
			const projectRepository = yield* ProjectRepository;
			const input = Schema.decodeUnknownSync(updateProjectInputSchema)(
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
				`User ${session?.user?.id} is not authorized to update project ${input.id}`
			);

			// Update the project
			yield* projectRepository.updateProject({
				id: input.id,
				name: input.name,
			});

			yield* Effect.log(`Updated project ${input.id}`);

			return yield* Effect.succeed(undefined);
		}),
		AuthSession.withAuthSession()
	);
