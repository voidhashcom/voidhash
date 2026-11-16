import type {
  AuditLogEntryJsonEncoding,
  OrganizationMemberJsonEncoding,
} from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Command, Flag } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { resolveProject } from "../context";
import { formatTimeAgo, outputModeOf, printIds, printJson, printTable } from "../output";
import { outputOptions, projectOption } from "../shared-options";

/** Who made a change, as people say it. */
const actorOf =
  (members: ReadonlyArray<OrganizationMemberJsonEncoding>) =>
  (entry: AuditLogEntryJsonEncoding) => {
    if (entry.actorType === "system") return "Voidhash";
    if (entry.actorType === "api_key") return "a secret key";
    return Option.match(
      Arr.findFirst(members, (member) => member.userId === entry.actorUserId),
      {
        onNone: () => entry.actorUserId ?? "someone",
        onSome: (member) => member.email,
      },
    );
  };

/** `voidhash-cli audit [--type] [--entity] [--limit]` */
export const auditCommand = Command.make(
  "audit",
  {
    type: Flag.String("type").pipe(
      Flag.withDescription(
        "Only changes to this kind of thing, such as product, paywall or api_key",
      ),
      Flag.optional,
    ),
    entity: Flag.String("entity").pipe(
      Flag.withDescription("Only changes to the thing with this id"),
      Flag.optional,
    ),
    limit: Flag.Int("limit").pipe(
      Flag.withDescription("How many of the latest changes to show, at most 100"),
      Flag.withDefault(30),
    ),
    project: projectOption,
    ...outputOptions,
  },
  ({ entity, json, limit, project, quiet, type }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const page = yield* api.auditLogList(context.project.id, {
        limit: Math.min(Math.max(limit, 1), 100),
        entityType: Option.getOrUndefined(type),
        entityId: Option.getOrUndefined(entity),
      });
      const entries = page.data;
      if (mode === "json") return yield* printJson(entries);
      if (mode === "quiet") return yield* printIds(entries);
      // Names for people only; a key or a role that cannot list members sees ids.
      const members = yield* readAll((query) =>
        api.organizationMembersList(context.project.organizationId, query),
      ).pipe(Effect.orElseSucceed(() => []));
      const now = yield* DateTime.now;
      yield* printTable(
        [
          {
            header: "WHEN",
            cell: (entry) => (entry.createdAt === null ? "-" : formatTimeAgo(entry.createdAt, now)),
          },
          { header: "WHO", cell: actorOf(members) },
          { header: "ACTION", cell: (entry) => entry.action },
          { header: "WHAT", cell: (entry) => `${entry.entityType} ${entry.entityId}` },
        ],
        entries,
        Option.isSome(type) || Option.isSome(entity)
          ? "No changes match."
          : "Nothing has been changed in this project yet.",
      );
      if (page.pageInfo.hasNextPage) {
        yield* Console.error(
          "There are older changes: raise --limit, or narrow with --type or --entity.",
        );
      }
    }),
).pipe(
  Command.withDescription(
    "Show who changed what in the project, newest first. Needs permission to read the project's audit log.",
  ),
);
