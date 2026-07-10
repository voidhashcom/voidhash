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
    <View
      style={{
        flex: 1,
        paddingTop: 24,
        paddingRight: 24,
        paddingBottom: 24,
        paddingLeft: 24,
        justifyContent: "flex-end",
      }}
    >
      <Text style={{ fontSize: 28, fontWeight: "700" }}>Go Pro</Text>
      <Pressable
        onPress={() => purchase()}
        style={{
          backgroundColor: "#16a34a",
          paddingTop: 16,
          paddingRight: 16,
          paddingBottom: 16,
          paddingLeft: 16,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          borderBottomRightRadius: 12,
          borderBottomLeftRadius: 12,
        }}
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

## Custom editor panels

A component may declare an optional `panel` to replace the visual editor's
default prop rows with a bespoke layout. It is a pure function
`(ctx) => ReactNode` built from `Panel.*` primitives (from
`@voidhash/paywalls/panel`):

```tsx
import { defineComponent, Text } from "@voidhash/paywalls";
import { Panel } from "@voidhash/paywalls/panel";

export const definition = defineComponent({
  id: "feature-card",
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
```

`ctx.props.<name>` is a **`PanelPropHandle`** — the read/write surface over the
currently-selected instance(s):

- `value` — the host's current value (resolved to the bound variable's value
  when `bound`), `undefined` when unset.
- `mixed` — `true` across a multi-selection whose instances hold differing
  values (render a "Mixed" affordance, not one node's value).
- `bound` — `true` when a variable drives the prop; the host owns bind/unbind
  chrome and a guest `set` on a bound prop is dropped.
- `set(value, { gesture })` — writes a new value. `gesture: "live"` is a
  transient drag value (no undo entry); `gesture: "commit"` (the default) is the
  final value on release and pushes **one** undo entry.
- `reset()` — restores the prop to its declared default.

Compose custom rows with two host-expansion nodes so you never re-implement the
built-in editors: `<Panel.PropField name="…" />` renders the host's default
editor for a single prop inside your own `Panel.Section`, and
`<Panel.DefaultProps exclude={[…]} />` renders the default rows for every
remaining prop (above, the title/subtitle are laid out by hand and the rest fall
through to `DefaultProps`). Omitting `panel` entirely yields the default panel:
one host-rendered row per manifest prop.

**Security.** A panel never runs in the editor's context. Its compiled module is
evaluated in a locked-down sandbox and it emits only serializable *intents* — a
panel function and its React tree never cross the boundary. Only validated data
crosses: prop values in, `set-prop`/`reset-prop` intents out (each re-validated
against the manifest by the host). Events are addressed purely by
`(nodeId, name)`; no callbacks or object references are transported.

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
  `@voidhash/paywalls/tree`) — renders components (real hooks included) to the
  §3 preview node tree via a custom `react-reconciler` host. **This is the one
  render-to-preview-tree path** — the CLI runs it in Node, the studio sandbox
  runs the same code (bundled with react) inside its iframe. It is **async**:
  the reconciler commits, one passive-effect flush + one macrotask tick settle
  the tree, then the committed `PaywallNodeTree` is read back. `<Slot/>` becomes
  a `{ type: "slot" }` node; components that never stabilize within that one
  settle budget are out of contract (see the deploy contract §3).
- `@voidhash/paywalls/panel` — data-only `Panel` primitives for future custom
  editor panels (inert in Phase 1).

## Wire schema — `@voidhash/paywalls/schema`

The single source of the deploy-contract wire types (§2 component manifest, §3
preview node tree, §3.1 `PaywallStyle`) plus their version constants
(`treeVersion`, `manifestVersion`) and **dependency-free** runtime validators
— no `effect`, no `react`, safe to import anywhere including the server trust
boundary:

- `parsePreviewTree(json)` / `parseComponentManifest(json)` — decode + validate,
  returning a `ParseResult` (rejecting unknown node types / keys per §3).
- `countSlotNodes(tree)` — enforce the at-most-one-`<Slot/>` rule.
- `PAYWALL_STYLE_KEYS` (a `ReadonlySet<string>`) and `PAYWALL_STYLE_KEY_LIST`
  (the ordered array it derives from, tied to `PaywallStyle`'s keys) — the §3.1
  style-key allowlist.
- `PREVIEW_STATE_PATTERN` — the `state`-name regex.

The closed mono mirrors these with effect-Schema validators and a contract test
that locks the two in lock-step (version equality, style-key-set equality,
fixture round-trip).

## Composition — `@voidhash/paywalls/compose`

The constrained-JSX composition surface for `.paywall.tsx` files that compose
paywalls out of screens, layout, and deployed components. Two audiences share
this entry, and it is **mimic-free** (never imports the document model):

- **Authors** import the inert author surface — `paywall`, `Screen`, `View`,
  `Text`, `Component`, `variable`, `product`, `purchase`, `closePaywall`,
  `none`, `payload`. These are analyzed, never executed.
- **Tooling** imports the toolchain: `parseComposition` (a TS-parser whitelist
  grammar → the public serializable `CompositionAST`), the deterministic
  `printComposition` (AST → source; round-trip = reconcile no-op),
  `generateComposeDts` (Monaco ambient types), the registry vocabulary, and the
  `CompositionAST` node types. `CompositionError` carries grammar diagnostics.

The mimic snapshot ↔ AST lift/lower and CRDT reconcile stay in the closed
`paywall-composition` bridge, driven by this AST.

## Studio sandbox — `@voidhash/paywalls/sandbox`

Dev-only, for the studio's in-browser render iframe (not part of any shipped
paywall bundle):

- `renderComponentToTree(definition, { state, props, hostData })` — render one
  component's preview state to a §3 node tree, built on `renderToNodeTree`.
- `extractComponentManifest(definition)` — the §2 manifest for a component.
- `modules` / `SANDBOX_GLOBAL_NAME` — the `require`-shim module registry (maps
  `@voidhash/paywalls`, `@voidhash/paywalls/jsx-runtime`, `react`,
  `react/jsx-runtime` onto one shared React) and the IIFE global name.
- `./sandbox-bundle` — the prebuilt IIFE bundle text (react + react-reconciler
  - tree + schema + author surface) the studio evals inside the iframe.
- `./sandbox-dts` — the Monaco ambient `.d.ts` text, **generated from the real
  `.d.ts`** at build time (never hand-written), so editor types can't drift.

The sandbox bootstrap freezes `Date.now` / `Math.random` / `performance.now` /
`requestAnimationFrame` so preview trees are deterministic "poster frames".

## JSX runtime — `@voidhash/paywalls/jsx-runtime`

`@voidhash/paywalls/jsx-runtime` and `@voidhash/paywalls/jsx-dev-runtime`
re-export `react/jsx-runtime` so `jsxImportSource: "@voidhash/paywalls"` resolves
everywhere (sandbox, CLI, user projects) — author code imports only
`@voidhash/paywalls`. The root entry also re-exports React's hooks (`useState`,
`useEffect`, `useMemo`, `useCallback`, `useRef`) for the same reason.
