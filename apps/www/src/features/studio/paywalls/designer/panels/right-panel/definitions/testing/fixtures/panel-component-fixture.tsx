/**
 * A demo component definition WITH a custom editor `panel`, for Phase 3b/4 tests
 * and docs. It exercises the component-panel authoring surface end-to-end: a
 * `panel` fn built from `Panel.*` primitives that reads `ctx.props.*` and writes
 * via `set`/`reset`, plus the two host-expansion nodes (`Panel.PropField`,
 * `Panel.DefaultProps`) that the host renders as real prop-row editors.
 *
 * The source is ALSO exported as a string so a future authoring/round-trip test
 * (Phase 4) can compile it; the object export is what an in-process
 * {@link createPanelSession} runs directly (no iframe needed in jsdom).
 */
import { defineComponent, Text } from "@voidhash/paywalls";
import { Panel } from "@voidhash/paywalls/panel";

/**
 * A "Feature Card" component: a title + subtitle string, a highlighted toggle,
 * and a variant select. Its panel groups the title into a custom Section, then
 * defers the rest to the host's default rows via `DefaultProps` (excluding the
 * title it renders itself).
 */
export const featureCardWithPanel = defineComponent({
  props: (p) => ({
    title: p.string().default("Feature"),
    subtitle: p.string().default("Describe it"),
    highlighted: p.boolean().default(false),
    variant: p.select(["solid", "outline"]).default("solid"),
  }),
  panel: (ctx) => (
    <Panel>
      <Panel.Section title="Content">
        <Panel.Field label="Title">
          <Panel.TextField
            kind="text"
            onCommit={(value: string) => ctx.props.title.set(value, { gesture: "commit" })}
            value={ctx.props.title.value ?? ""}
          />
        </Panel.Field>
        <Panel.PropField name="subtitle" />
      </Panel.Section>
      <Panel.Section title="Style">
        <Panel.DefaultProps exclude={["title", "subtitle"]} />
      </Panel.Section>
    </Panel>
  ),
  render: (ctx) => <Text>{ctx.props.title}</Text>,
});

/**
 * The same definition as an authorable source string (for the Phase 4 compile /
 * round-trip path). Kept in sync with {@link featureCardWithPanel} by hand.
 */
export const FEATURE_CARD_SOURCE = `import { defineComponent, Text } from "@voidhash/paywalls";
import { Panel } from "@voidhash/paywalls/panel";

export default defineComponent({
  props: (p) => ({
    title: p.string().default("Feature"),
    subtitle: p.string().default("Describe it"),
    highlighted: p.boolean().default(false),
    variant: p.select(["solid", "outline"]).default("solid"),
  }),
  panel: (ctx) => (
    <Panel>
      <Panel.Section title="Content">
        <Panel.Field label="Title">
          <Panel.TextField
            kind="text"
            value={ctx.props.title.value ?? ""}
            onCommit={(value) => ctx.props.title.set(value, { gesture: "commit" })}
          />
        </Panel.Field>
        <Panel.PropField name="subtitle" />
      </Panel.Section>
      <Panel.Section title="Style">
        <Panel.DefaultProps exclude={["title", "subtitle"]} />
      </Panel.Section>
    </Panel>
  ),
  render: (ctx) => <Text>{ctx.props.title}</Text>,
});
`;
