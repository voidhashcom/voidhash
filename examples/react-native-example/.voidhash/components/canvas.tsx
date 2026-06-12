import { defineComponent, Slot, Text, View } from "@voidhash/paywalls";

/**
 * A titled container the editor can drop other elements into (via the slot).
 */
export default defineComponent({
  id: "canvas",
  title: "Canvas",
  description: "A titled container with a slot for nested content.",
  props: (p) => ({
    title: p.string().label("Title").default("Untitled"),
  }),
  render: ({ props }) => (
    <View style={{ gap: 8, padding: 16 }}>
      <Text style={{ color: "white", fontSize: 18, fontWeight: "700" }}>
        {props.title}
      </Text>
      <Slot />
    </View>
  ),
});
