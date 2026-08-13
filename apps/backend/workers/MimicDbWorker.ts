import { makeMimicDbWorker } from "@voidhash/mimic-db/cloudflare/MimicDbWorker";
import { PaywallMigrationRegistry } from "@voidhash/mimic-schema";

import { DatabaseHyperdrive } from "../infrastructure/Hyperdrive.ts";

export const MIMIC_DB_DEV_PORT = 5001;

/** Community deployment composition for the mimic-db Cloudflare Worker. */
const MimicDbWorker: ReturnType<typeof makeMimicDbWorker> = makeMimicDbWorker({
  devPort: MIMIC_DB_DEV_PORT,
  hyperdrive: DatabaseHyperdrive,
  main: import.meta.filename,
  migrations: PaywallMigrationRegistry,
});

export default MimicDbWorker;
