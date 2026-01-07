import { createCommander } from "@voidhash/mimic-react/zustand-commander";

import type { DesignerStoreState } from "./designer-store-state";

export const commander = createCommander<DesignerStoreState>();
