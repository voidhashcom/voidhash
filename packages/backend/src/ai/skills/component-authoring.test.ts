import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { componentAuthoringSkill } from "./component-authoring.ts";

const skill = componentAuthoringSkill();

const localPath = (relative: string) =>
  decodeURIComponent(new URL(relative, import.meta.url).pathname);

const PLUGIN_SKILL_PATH = localPath(
  "../../../../../plugins/voidhash/skills/code-component-authoring/SKILL.md",
);
const CLAUDE_SKILL_PATH = localPath(
  "../../../../../integrations/claude-code/voidhash/skills/code-component-authoring/SKILL.md",
);

describe("componentAuthoringSkill — delivery channels", () => {
  it("keeps the MCP and Codex plugin bodies identical", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const filesystemSkill = yield* fileSystem.readFileString(PLUGIN_SKILL_PATH);
        const claudeSkill = yield* fileSystem.readFileString(CLAUDE_SKILL_PATH);
        const filesystemBody = filesystemSkill.slice(filesystemSkill.indexOf("\n---\n") + 5).trim();

        expect(skill.trim()).toBe(filesystemBody);
        expect(claudeSkill).toBe(filesystemSkill);
        expect(skill).not.toContain("TODO");
      }).pipe(Effect.provide(NodeServices.layer)),
    ));
});

describe("componentAuthoringSkill — component contract", () => {
  it("documents the complete authoring and MCP lifecycle", () => {
    for (const marker of [
      "begin_paywall_edit",
      "get_components",
      "read_component",
      "write_component",
      "rename_component",
      "delete_component",
      "get_paywall_preview",
      "defineComponent",
      "Prop builders",
      "Actions",
      "Previews and slots",
      "Runtime hooks",
      "cancelled",
    ]) {
      expect(skill).toContain(marker);
    }
  });

  it("lists every prop builder and the author-visible primitives", () => {
    for (const builder of [
      "p.string()",
      "p.number()",
      "p.boolean()",
      "p.select(",
      "p.image()",
      'p.ref("product")',
      "p.component()",
      "p.array(item)",
    ]) {
      expect(skill).toContain(builder);
    }
    for (const primitive of ["View", "Text", "Pressable", "ScrollView", "Image", "Slot"]) {
      expect(skill).toContain(`\`${primitive}\``);
    }
  });
});

describe("componentAuthoringSkill — custom panels", () => {
  it("lists every Panel primitive", () => {
    for (const primitive of [
      "Section",
      "SectionActions",
      "Subsection",
      "Row",
      "Column",
      "Field",
      "Text",
      "Callout",
      "Popover",
      "PopoverTrigger",
      "PopoverContent",
      "Menu",
      "TextField",
      "SelectField",
      "ToggleGroup",
      "SwitchField",
      "Button",
      "SliderField",
      "ResetAffordance",
      "ColorField",
      "ColorPicker",
      "GradientStops",
      "Swatch",
      "ImageField",
      "AlignmentGrid",
      "DimensionField",
      "FillField",
      "VariableField",
      "ActionEditorField",
      "ProductField",
      "PropField",
      "DefaultProps",
    ]) {
      expect(skill).toContain(`Panel.${primitive}`);
    }
  });

  it("documents mixed/bound/ref handles, limits, and gesture writes", () => {
    expect(skill).toContain("ctx.selection.count");
    expect(skill).toContain("bound: boolean");
    expect(skill).toContain("value: PaywallProduct | undefined");
    expect(skill).toContain('gesture?: "live" | "commit"');
    expect(skill).toContain("2,000 nodes");
    expect(skill).toContain("eight event names per node");
    expect(skill).toContain("coalesces live writes per prop per frame");
    expect(skill).toContain("Current Studio custom sessions send `products: []`");
    expect(skill).toContain("a 6-second init deadline");
    expect(skill).toContain("caps intents at 240/second");
    expect(skill).toContain("10 seconds of inactivity");
    expect(skill).toContain("onStopColorChange?");
    expect(skill).toContain("onOpenChange?");
  });
});

describe("componentAuthoringSkill — motion and gestures", () => {
  it("lists the complete motion output vocabulary and hooks", () => {
    for (const key of [
      "x",
      "y",
      "scale",
      "scaleX",
      "scaleY",
      "rotate",
      "opacity",
      "backgroundColor",
      "transformOrigin",
    ]) {
      expect(skill).toContain(`\`${key}\``);
    }
    for (const hook of [
      "useMotionValue",
      "useMotionValueEvent",
      "useTransform",
      "useSpring",
      "useVelocity",
      "useMotionRef",
      "useScroll",
      "useInView",
      "useDragControls",
      "useMotionConfig",
      "useReducedMotion",
    ]) {
      expect(skill).toContain(hook);
    }
  });

  it("documents variants, reduced motion, static previews, and drag arbitration", () => {
    expect(skill).toContain("Active interaction targets overlay in this order");
    expect(skill).toContain('reducedMotion: "user" | "always" | "never"');
    expect(skill).toContain("Static previews never run live animation");
    expect(skill).toContain("matching-axis ancestor ScrollView win");
    expect(skill).toContain("roughly three logical pixels");
    expect(skill).toContain("Transforms compile in this fixed order");
    expect(skill).toContain("Target values win");
    expect(skill).toContain("counts zero overlap as in view");
    expect(skill).toContain("current DOM adapter ignores both");
    expect(skill).toContain("post-claim displacement strictly on that axis");
    expect(skill).toContain("There is no `whileHover`");
  });
});
