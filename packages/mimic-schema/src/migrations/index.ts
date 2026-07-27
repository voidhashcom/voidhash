import { defineMigrationRegistry } from "@voidhash/mimic-server/migrate";

import { PaywallDocumentBaseline } from "./00000_baseline.ts";

export const MIMIC_DATABASE_NAME = "voidhash";
export const MIMIC_PAYWALLS_COLLECTION_NAME = "paywalls";

/** Deployed document migrations shared by the supported server runtimes. */
export const PaywallMigrationRegistry = defineMigrationRegistry([
  {
    database: MIMIC_DATABASE_NAME,
    databaseDescription: "Voidhash paywall documents",
    collection: MIMIC_PAYWALLS_COLLECTION_NAME,
    baseline: PaywallDocumentBaseline,
    migrations: [],
  },
]);
