import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";

/** Metadata disclosed to an agent before a skill body is loaded. */
export interface SkillMetadata {
  readonly name: string;
  readonly description: string;
}

/** Runtime-neutral source of progressively disclosed agent skills. */
export interface SkillSource {
  readonly list: () => ReadonlyArray<SkillMetadata>;
  readonly read: (name: string) => string | undefined;
}

/** Renders Pi-compatible skill metadata for inclusion in a system prompt. */
export const renderSkillDisclosure = (source: SkillSource): string => {
  const skills = source.list();
  if (skills.length === 0) return "";
  const entries = skills
    .map(
      ({ name, description }) =>
        `<skill>\n<name>${escapeXml(name)}</name>\n<description>${escapeXml(description)}</description>\n</skill>`,
    )
    .join("\n");
  return `<available_skills>\n${entries}\n</available_skills>`;
};

const ReadSkillParameters = Type.Object(
  { name: Type.String({ description: "Skill name from the available_skills list." }) },
  { additionalProperties: false },
);

/** Creates the progressive-disclosure tool backed by a non-filesystem skill source. */
export const makeReadSkillTool = (
  source: SkillSource,
): AgentTool<typeof ReadSkillParameters, { readonly name: string }> => ({
  name: "read_skill",
  label: "Read skill",
  description:
    "Read the complete instructions for one available skill. Call this before using a relevant skill.",
  parameters: ReadSkillParameters,
  execute: async (_toolCallId, input) => {
    const body = source.read(input.name);
    if (body === undefined) {
      throw new Error(`Unknown skill: ${input.name}`);
    }
    return {
      content: [{ type: "text", text: body }],
      details: { name: input.name },
    };
  },
});

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
