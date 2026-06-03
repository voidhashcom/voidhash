
import { defineComponent, View, Text, Slot } from "@voidhash/paywalls"

export const componentDefinition = defineComponent({
  props: (c) => ({
    title: c.string().withLabel("Title").withDefault("Untitled")
  })
})

export default componentDefinition.render((props) => {
  return (
    <View>
      <Text>Canvas {props.title}</Text>
      <Slot />
    </View>
  )
})
