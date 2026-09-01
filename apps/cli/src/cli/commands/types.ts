import { Command } from "effect/unstable/cli";
import * as Effect from "effect/Effect";

import { typesCheckCommand } from "./types-check";
import { typesGenerateCommand } from "./types-generate";

export const typesCommand = Command.make("types", {}, () =>
  Effect.gen(function* typesCommand() {}),
).pipe(
  Command.withDescription("Generate and validate the Voidhash TypeScript declaration file."),
  Command.withSubcommands([typesGenerateCommand, typesCheckCommand]),
);
