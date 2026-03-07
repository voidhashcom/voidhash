import { Prompt } from "effect/unstable/cli";
import { Data, Effect, FileSystem } from "effect";

export class FileExistsError extends Data.TaggedError("FileExistsError")<{
  readonly message: string;
}> {}

/**
 * Asserts that a file can be created at the given path.
 * If the file already exists, it will ask the user if they want to overwrite it.
 * @param filename - The name of the file to create.
 * @param pathToAssert - The path to assert the file can be created at.
 * @returns An Effect that succeeds if the file can be created, or fails if the file already exists and the user does not want to overwrite it.
 */
export const assertFileCanBeCreated = (
  filename: string,
  pathToAssert: string
) =>
  Effect.gen(function* assertFileCanBeCreated() {
    const fileSystem = yield* FileSystem.FileSystem;

    const fileExists = yield* fileSystem.exists(pathToAssert);
    if (fileExists) {
      // Ask user if they want to overwrite the file
      const overwrite = yield* Prompt.run(
        Prompt.confirm({
          message: `File ${filename} already exists. Do you want to overwrite it?`,
        })
      );
      if (!overwrite) {
        return yield* Effect.fail(
          new FileExistsError({ message: "File already exists" })
        );
      }

      return yield* Effect.succeed(true);
    }
  });
