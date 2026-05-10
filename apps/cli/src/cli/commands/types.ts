import { Command } from "effect/unstable/cli";
import { Effect } from "effect";

import { debugOption } from "../shared-options";
import { typesCheckCommand } from "./types-check";
import { typesGenerateCommand } from "./types-generate";

export const typesCommand = Command.make(
  "types",
  { debug: debugOption },
  () => Effect.gen(function* typesCommand() {})
).pipe(
  Command.withDescription(
    "Generate and validate the Voidhash TypeScript declaration file."
  ),
  Command.withSubcommands([typesGenerateCommand, typesCheckCommand])
);
