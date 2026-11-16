import type { ApiKeyJsonEncoding } from "@voidhash/generated-clients";
import { isFullKeyAccess } from "@voidhash/lib/constants";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Command, Flag } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { resolveProject } from "../context";
import {
  formatDate,
  formatTimeAgo,
  outputModeOf,
  printIds,
  printJson,
  printTable,
} from "../output";
import { outputOptions, projectOption } from "../shared-options";

const MANAGED_IN_DASHBOARD =
  "Keys are created, rotated and deleted by a person in the dashboard: 'voidhash-cli open keys'.";

/** The key as people tell it apart: a publishable key in full, a secret key by its ends. */
const keyValue = (key: ApiKeyJsonEncoding) =>
  key.type === "publishable" && key.rawKey !== null ? key.rawKey : `${key.prefix}…${key.end}`;

/**
 * What a key may do: "full" for a secret key holding every permission a key
 * may be given (older keys store no scopes for it), else its scopes.
 */
const keyAccess = (key: ApiKeyJsonEncoding) => {
  if (key.type === "publishable") return "SDK in apps";
  const scopes = key.scopes;
  return scopes === null || isFullKeyAccess(scopes) ? "full" : scopes.join(", ");
};

/** `voidhash-cli key list [--environment production|test]` */
const keyListCommand = Command.make(
  "list",
  {
    environment: Flag.Literals("environment", ["production", "test"]).pipe(
      Flag.withDescription("Only the keys of production, or of test (a staging server's)"),
      Flag.optional,
    ),
    project: projectOption,
    ...outputOptions,
  },
  ({ environment, json, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const keys = yield* readAll((query) =>
        api.apiKeysList(projectId, { ...query, environment: Option.getOrUndefined(environment) }),
      );
      if (mode === "json") return yield* printJson(keys);
      if (mode === "quiet") return yield* printIds(keys);
      const now = yield* DateTime.now;
      yield* printTable(
        [
          { header: "NAME", cell: (key) => key.name },
          { header: "TYPE", cell: (key) => key.type },
          { header: "ENVIRONMENT", cell: (key) => key.environment },
          { header: "KEY", cell: keyValue },
          { header: "ACCESS", cell: keyAccess },
          {
            header: "EXPIRES",
            cell: (key) => (key.expiresAt === null ? "-" : formatDate(key.expiresAt)),
          },
          {
            header: "LAST USED",
            cell: (key) => (key.lastUsedAt === null ? "-" : formatTimeAgo(key.lastUsedAt, now)),
          },
          { header: "ID", cell: (key) => key.id },
        ],
        keys,
        "The project has no keys.",
      );
      yield* Console.error(MANAGED_IN_DASHBOARD);
    }),
).pipe(
  Command.withDescription(
    "List the project's API keys: the publishable keys apps ship with, and secret keys by their ends. A production key reads production purchases; a test key, such as a staging build's or server's, reads store sandbox and test purchases and records what it reports as test. Debug builds simulate purchases only with the test publishable key.",
  ),
);

/** `voidhash-cli key …` */
export const keyCommand = Command.make("key").pipe(
  Command.withAlias("keys"),
  Command.withDescription(
    `See the project's API keys. ${MANAGED_IN_DASHBOARD.replace("'voidhash-cli open keys'", "voidhash-cli open keys")}`,
  ),
  Command.withSubcommands([keyListCommand]),
);
