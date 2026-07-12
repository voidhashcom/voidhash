import type { BuiltinComponentDefinition } from "./types.ts";

/**
 * TEMPORARY spine-verification builtin — a static badge that renders its
 * `label` prop. Exists only to exercise the `componentSource: "builtin"`
 * resolution path end-to-end; REMOVE before go-live, once the first real
 * builtin lands.
 */
export const sampleBadge: BuiltinComponentDefinition = {
  slug: "sample-badge",
  name: "Sample Badge",
  description: "Temporary spine-verification badge rendering a static label.",
  manifest: {
    manifestVersion: 2,
    title: "Sample Badge",
    description: "Temporary spine-verification badge rendering a static label.",
    props: {
      label: {
        kind: "string",
        label: "Label",
        default: "New",
        optional: false,
      },
    },
    actions: {},
    slot: false,
    previewStates: ["default"],
    hostData: [],
  },
  defaultProps: [
    {
      name: "label",
      value: { type: "literal", value: { key: "string", value: "New" } },
    },
  ],
};
