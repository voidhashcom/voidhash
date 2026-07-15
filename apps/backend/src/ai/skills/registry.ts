import type { SkillSource } from "@voidhash/agent/SkillSource";

import { paywallAuthoringSkill } from "./paywall-authoring.ts";

/** One lazily materialized skill delivered through every agent channel. */
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
  return uri.startsWith(prefix) ? findSkill(uri.slice(prefix.length)) : undefined;
};
