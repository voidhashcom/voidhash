/** Starter source for a newly created code component — compiles + previews immediately. */
export const SCAFFOLD_SOURCE = `import { defineComponent, View, Text, Slot } from "@voidhash/paywalls";

export default defineComponent({
  props: (p) => ({
    title: p.string().default("Hello"),
    accentColor: p.string().editor("color").default("#6366f1"),
  }),
  previews: {
    default: {},
  },
  render: ({ props }) => (
    <View
      style={{
        paddingTop: 16,
        paddingRight: 16,
        paddingBottom: 16,
        paddingLeft: 16,
        gap: 8,
        backgroundColor: props.accentColor,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderBottomRightRadius: 12,
        borderBottomLeftRadius: 12,
      }}
    >
      <Text style={{ color: "white", fontSize: 18, fontWeight: "700" }}>{props.title}</Text>
      <Slot />
    </View>
  ),
});
`;
