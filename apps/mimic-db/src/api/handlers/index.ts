import { Layer } from "effect";

import { DatabasesHandlersLive } from "./databases.ts";
import { CollectionsHandlersLive } from "./collections.ts";
import { MigrationsHandlersLive } from "./migrations.ts";
import { UsersHandlersLive } from "./users.ts";
import { GrantsHandlersLive } from "./grants.ts";
import { DocumentsHandlersLive } from "./documents.ts";
import { DocumentAuthHandlersLive } from "./document-auth.ts";

export const ApiHandlersLive = Layer.mergeAll(
  DatabasesHandlersLive,
  CollectionsHandlersLive,
  MigrationsHandlersLive,
  UsersHandlersLive,
  GrantsHandlersLive,
  DocumentsHandlersLive,
  DocumentAuthHandlersLive,
);
