import { createCommander } from "@voidhash/mimic/zustand-commander";
import type { PaywallDesignerDocument } from "@voidhash/mimic-schema";

import type { DesignerStoreState } from "./designer-store-state";

export const commander = createCommander<DesignerStoreState, typeof PaywallDesignerDocument>();
