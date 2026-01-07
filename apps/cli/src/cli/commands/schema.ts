import { Command } from "@effect/cli";
import { Effect } from "effect";

import { debugOption } from "../shared-options";
import { schemaCheckCommand } from "./schema-check";
import { schemaPullCommand } from "./schema-pull";
import { schemaPushCommand } from "./schema-push";

export const schemaCommand = Command.make("schema", { debug: debugOption }, () =>
  Effect.gen(function* schemaCommand() {})
).pipe(
  Command.withDescription("Manage the Voidhash schema."),
  Command.withSubcommands([
    schemaPullCommand,
    schemaPushCommand,
    schemaCheckCommand,
  ])
);
