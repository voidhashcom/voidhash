# @voidhash/paywalls

Code-driven paywall authoring runtime and renderer for Voidhash.

Paywalls are React trees written with a React-Native-like primitive set and
rendered by a **pluggable renderer**. The default renderer targets the DOM
(used by Studio and the deployed WebView bundle); the Node-only tree renderer
serializes the same components into the preview node trees the visual editor
consumes. Author code never references a platform.

The wire formats this package implements (runtime config, bridge envelopes,
component manifest, preview node tree) are specified in
[`docs/specs/paywall-deploy-contract.md`](../../docs/specs/paywall-deploy-contract.md).

## Authoring a paywall

`.voidhash/paywalls/*.tsx`

```tsx
import { createPaywall, View, Text, Pressable, usePaywallActions } from "@voidhash/paywalls";

function Body() {
  const { purchase } = usePaywallActions();
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "flex-end" }}>
      <Text style={{ fontSize: 28, fontWeight: "700" }}>Go Pro</Text>
      <Pressable
        onPress={() => purchase()}
        style={{ backgroundColor: "#16a34a", padding: 16, borderRadius: 12 }}
      >
        <Text style={{ color: "white", textAlign: "center" }}>Subscribe</Text>
      </Pressable>
    </View>
  );
}

export default createPaywall({
  title: "Onboarding",
  products: ["yearly", "monthly"],
  variables: { accentColor: "#16a34a" },
  render: () => <Body />,
});
```

## Reusable components

`.voidhash/components/*.tsx`

```tsx
import { defineComponent, Pressable, Slot, Text } from "@voidhash/paywalls";

export const definition = defineComponent({
  id: "product-option",
  title: "Product Option",
  props: (p) => ({
    product: p.ref("product"),
    accentColor: p.string().editor("color").default("#16a34a"),
  }),
  actions: (a) => ({
    onSelect: a.action({ productId: a.string() }),
  }),
  previews: {
    default: {
      data: {
        products: [
          /* fixture products */
        ],
      },
    },
  },
  render: ({ props, actions }) => (
    <Pressable onPress={actions.onSelect} style={{ borderColor: props.accentColor }}>
      <Text>{props.product.displayName}</Text>
      <Slot /> {/* children passed by the consumer render here */}
    </Pressable>
  ),
});

export const ProductOption = definition.component;
```

The prop builder (`p`) records both the prop's **type** (for type-safe
templates) and its **editor metadata** which the component manifest and the
visual editor consume. Kinds: `string`, `number`, `boolean`,
`select(options)`, `image`, `ref("product")`, `component`, `array(item)` —
each chainable with `.label()`, `.default()`, `.editor("color")`,
`.optional()`.

Declared actions become typed callbacks in the template (`actions.onSelect`)
that forward to the consumer prop of the same name. `extractComponentManifest(definition)`
emits the §2 manifest JSON (props, actions, slot usage, preview states,
host data).

## Primitives

`View`, `Text`, `Pressable`, `ScrollView`, `Image`, `Slot` — RN-style props
(`style`, `onPress`, `numberOfLines`, `resizeMode`, …). The `style` prop is
typed as `PaywallStyle`, the RN-compatible subset from the deploy contract
(§3.1) — arbitrary CSS does not compile.

## Runtime

Hooks read the runtime config the host supplies (injected
`window.__VOIDHASH_PAYWALL__` or a late `configure` bridge message):

- `usePaywallProducts()` — products to display.
- `usePaywallVariables()` — dashboard/experiment overrides.
- `useSelectedProduct()` — selected product + setter.
- `usePaywallActions()` — `purchase`, `restore`, `close`, `openUrl`, `track`,
  `selectProduct`.
- `usePaywallStatus()` — transaction lifecycle (idle/purchasing/purchased/…).
- `usePaywallConfig()` — the full config (locale, platform, …).

Actions are sent to the native SDK as version-1 envelopes over the WebView
bridge; the envelope format mirrors
`@voidhash/react-native`'s `paywall-bridge/protocol.ts` (normative). In Studio
the same envelopes are posted to the parent frame as
`{ source: "voidhash-paywall", message }`.

## Rendering

- `PaywallRenderer` — embeds a paywall in an existing React tree (Studio).
- `mountPaywall(paywall, container)` (from `@voidhash/paywalls/dom`) — commits
  a paywall to a DOM container via `react-dom`; used by the deployed WebView
  bundle. Reads the injected config and applies `configure` messages.
- `renderToNodeTree(element, { config, state })` (from
  `@voidhash/paywalls/tree`, **Node-only**) — renders components (hooks
  included) to the §3 preview node tree via a custom `react-reconciler` host.
- `@voidhash/paywalls/panel` — data-only `Panel` primitives for future custom
  editor panels (inert in Phase 1).
