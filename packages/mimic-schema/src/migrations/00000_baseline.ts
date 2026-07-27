import { Primitive } from "@voidhash/mimic-core";

import { RootNode } from "../nodes/index.ts";

/** Document schema at the direct-migration cutover. */
export const PaywallDocumentBaseline = Primitive.Tree({
  root: RootNode,
});
