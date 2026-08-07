import type { SkillSource } from "@voidhash/agent/SkillSource";

import { componentAuthoringSkill } from "./component-authoring.ts";
import { paywallAuthoringSkill } from "./paywall-authoring.ts";

/** A lazily materialized skill delivered through every agent channel. */
export interface SkillDefinition {
  readonly name: string;
  readonly description: string;
  readonly body: () => string;
}

const definitions: ReadonlyArray<SkillDefinition> = [
  {
    name: "paywall-authoring",
    description:
      "Design, edit, preview, visually review, finish, or revert a Voidhash paywall with the shared workspace tools.",
    body: paywallAuthoringSkill,
  },
  {
    name: "code-component-authoring",
    description:
      "Create, edit, debug, and place Voidhash code components, including typed props and actions, preview fixtures, custom designer panels, animation, motion values, scroll-linked effects, drag gestures, and gesture-aware panel controls. Use when a paywall needs runtime data, loops, structural logic, custom formatting, pressed/focus states, animation, dragging, or a tailored component-properties panel, or when working with read_component, write_component, rename_component, or delete_component.",
    body: componentAuthoringSkill,
  },
];

/** Lists every registered skill without evaluating its body. */
export const listSkills = (): ReadonlyArray<SkillDefinition> => definitions;

/** Looks up one registered skill by its stable name. */
export const findSkill = (name: string): SkillDefinition | undefined =>
  definitions.find((definition) => definition.name === name);

/** Creates the non-filesystem skill source consumed by the Pi agent. */
export const registeredSkillSource = (): SkillSource => ({
  list: () => definitions.map(({ name, description }) => ({ name, description })),
  read: (name) => findSkill(name)?.body(),
});

/** Stable MCP resource URI for one registered skill. */
export const skillResourceUri = (name: string): string => `voidhash://skills/${name}`;

/** Resolves a registered skill from its MCP resource URI. */
export const skillFromResourceUri = (uri: string): SkillDefinition | undefined => {
  const prefix = "voidhash://skills/";
  if (!uri.startsWith(prefix)) return undefined;
  return findSkill(uri.slice(prefix.length));
};
