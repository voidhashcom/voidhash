import { Primitive } from "@voidhash/mimic-core";

import { RootNode } from "./nodes/index.ts";

export const PaywallDesignerDocument = Primitive.Tree({
  root: RootNode,
});

/** Encode/insert input for the document tree — an explicit array of root nodes. */
export type PaywallDesignerDocumentInput = NonNullable<
  Primitive.InferInput<typeof PaywallDesignerDocument>
>;

/**
 * Initial content for a freshly provisioned paywall document: a single
 * "Paywall" root containing one default screen. The engine never auto-creates
 * roots, so every new document must be seeded with this input (server-side
 * provisioning and client bootstrap of genuinely empty documents).
 */
export function createInitialPaywallDocumentInput(): PaywallDesignerDocumentInput {
  return [
    {
      type: "root",
      name: "Paywall",
      children: [{ type: "screen" }],
    },
  ];
}
