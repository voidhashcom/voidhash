import { createPaywall, View, Pressable, Text } from "@voidhash/paywalls"
import Canvas from '../components/canvas';

const paywall = createPaywall({
  title: "Onboarding paywall",
  render: (
    <View>
      <Pressable>
        <Text>Hello World</Text>
      </Pressable>
      <Canvas>
        <Text>Hello</Text>
      </Canvas>
    </View>
  )
})

export default paywall;
