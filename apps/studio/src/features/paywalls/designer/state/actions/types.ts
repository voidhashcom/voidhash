import type * as Y from "yjs";
import type { VoidsyncState } from "../../../../designer/voidsync";
import type { DesignerSchema } from "../schema";

/**
 * Type alias for the designer store state used in action factories.
 */
export type DesignerStoreState = VoidsyncState<DesignerSchema, Y.Doc>;
