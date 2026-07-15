/**
 * Complete author-facing reference for code components, custom editor panels,
 * runtime motion, and drag gestures. The body is also shipped as a filesystem
 * skill in the Voidhash Codex plugin; keep the contract test in sync when
 * changing either delivery channel.
 */
const COMPONENT_AUTHORING_SKILL = `# Code Component Authoring

Use this as the complete author-facing contract for local Voidhash code components.
Build ordinary composition with document nodes; use a code component only for behavior
the document cannot express, such as runtime-data text, loops, structural branching,
custom formatting, pointer states, motion, and drag gestures.

## MCP workflow

1. Call \`begin_paywall_edit({ paywallId })\` and retain its \`editSessionId\`.
2. Read the document with \`get_paywall\` and all placeable contracts with
   \`get_components\`. If editing a local component, read it with \`read_component\`.
3. Write one complete \`components/<name>.tsx\` source with \`write_component\`. Fix every
   compile or runtime diagnostic and retry; a rejected write commits nothing.
4. Place a successful local definition with a document \`component\` node:

   \`\`\`json
   {
     "op": "insert",
     "parentId": "<parent-id>",
     "node": {
       "type": "component",
       "name": "Animated offer",
       "componentSource": "local",
       "componentPath": "components/animated-offer.tsx"
     }
   }
   \`\`\`

5. Configure instance \`props\`, \`localizedValues\`, \`actionBindings\`, \`previewState\`, and
   slot children through \`edit_paywall\`, using the manifest returned by \`get_components\`.
6. Render \`get_paywall_preview\`, inspect the actual PNG, iterate, and finish or revert the
   edit session using the normal paywall-authoring workflow.

Treat the component path as identity. Valid paths are exactly
\`components/<basename>.tsx\`; the basename may use letters, digits, \`.\`, \`_\`, and \`-\`,
must not contain a separator or \`..\`, and is compared case-insensitively for collisions.
\`rename_component\` changes the identity and re-points local instances.
\`delete_component\` removes only the definition; existing instances become placeholders.

Author one self-contained file. Import runtime/component APIs from
\`@voidhash/paywalls\`, panel APIs from \`@voidhash/paywalls/panel\`, and nothing else.
Do not import \`react\` directly or use relative imports from an MCP-written component.
React hooks needed by authored code are re-exported by \`@voidhash/paywalls\`.

## Complete component pattern

\`\`\`tsx
import {
  defineComponent,
  MotionConfig,
  Pressable,
  Slot,
  Text,
  View,
  usePaywallActions,
  useSelectedProduct,
} from "@voidhash/paywalls";
import { Panel } from "@voidhash/paywalls/panel";

export default defineComponent({
  title: "Animated Offer",
  description: "A selectable offer with editable appearance.",
  props: (p) => ({
    title: p.string().label("Title").localizable().default("Annual Pro"),
    accent: p.string().label("Accent").editor("color").default("rgba(99, 102, 241, 1)"),
    radius: p.number().label("Radius").default(16),
    product: p.ref("product"),
    footer: p.component().optional(),
  }),
  actions: (a) => ({
    onSelect: a.action({ productId: a.string() }),
  }),
  previews: {
    default: {
      props: { title: "Annual Pro", accent: "rgba(99, 102, 241, 1)", radius: 16 },
      data: {
        products: [{
          id: "annual",
          slug: "annual",
          displayName: "Annual Pro",
          priceString: "$59.99",
          period: "year",
        }],
      },
    },
  },
  panel: (ctx) => (
    <Panel>
      <Panel.Section title="Content">
        <Panel.PropField name="title" />
        <Panel.PropField name="product" />
      </Panel.Section>
      <Panel.Section title="Appearance">
        <Panel.Field label="Accent">
          <Panel.ColorField
            disabled={ctx.props.accent.bound}
            mixed={ctx.props.accent.mixed}
            onChange={(value) => ctx.props.accent.set(value, { gesture: "live" })}
            onCommit={(value) => ctx.props.accent.set(value, { gesture: "commit" })}
            onDiscard={() => ctx.props.accent.cancel()}
            value={ctx.props.accent.value}
          />
        </Panel.Field>
        <Panel.Field label="Radius">
          <Panel.SliderField
            max={32}
            min={0}
            mixed={ctx.props.radius.mixed}
            onChange={(value) => ctx.props.radius.set(value, { gesture: "live" })}
            onCommit={(value) => ctx.props.radius.set(value, { gesture: "commit" })}
            value={ctx.props.radius.value}
          />
        </Panel.Field>
        <Panel.DefaultProps exclude={["title", "product", "accent", "radius"]} />
      </Panel.Section>
    </Panel>
  ),
  render: ({ props, actions }) => {
    const { selectedProductId } = useSelectedProduct();
    const runtime = usePaywallActions();
    const selected = selectedProductId === props.product.id;
    return (
      <MotionConfig reducedMotion="user">
        <Pressable
          accessibilityLabel={\`Select \${props.product.displayName}\`}
          onPress={() => {
            actions.onSelect({ productId: props.product.id });
            runtime.selectProduct(props.product.id);
          }}
          style={{
            backgroundColor: selected ? props.accent : "rgba(255, 255, 255, 1)",
            borderBottomLeftRadius: props.radius,
            borderBottomRightRadius: props.radius,
            borderTopLeftRadius: props.radius,
            borderTopRightRadius: props.radius,
            paddingBottom: 16,
            paddingLeft: 16,
            paddingRight: 16,
            paddingTop: 16,
          }}
          transition={{ type: "spring", stiffness: 240, damping: 22 }}
          whilePress={{ scale: 0.97 }}
        >
          <View initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Text>{props.title}</Text>
            <Text>{props.product.priceString}</Text>
            <Slot fallback={props.footer} />
          </View>
        </Pressable>
      </MotionConfig>
    );
  },
});
\`\`\`

## \`defineComponent\` contract

Use \`export default defineComponent({ ... })\`. A named constant that holds the call and is
default-exported is also accepted, but never export \`.component\`. There is no component
\`id\`; the file path is the identity.

- \`title?\` and \`description?\` supply editor/catalog metadata.
- \`props?: (p) => ({ ... })\` declares the editable input contract.
- \`actions?: (a) => ({ ... })\` declares named events an instance may bind.
- \`previews?: { [state]: { props?, data? } }\` supplies deterministic fixtures.
- \`panel?: (ctx) => ReactNode\` supplies a custom properties panel.
- \`render: ({ props, actions }) => ReactNode\` is required.

Module evaluation must be deterministic and fast. Put hooks inside \`render\`, \`panel\`, or
local React components, never at module scope. \`write_component\` evaluates the module,
extracts the manifest, and renders every component preview. It detects that a custom panel
exists but does not exercise every panel event; a panel can still fail when opened, in
which case Studio falls back to default prop controls.

Preview rendering flushes passive effects and waits one macrotask before serialization.
Keep effects finite and deterministic; do not start unbounded timers, event loops, or
network-dependent work in a preview.

### Prop builders

Every builder is immutable and chainable with \`.label(string)\`, \`.default(value)\`, and
\`.optional()\`.

- \`p.string()\` yields \`string\`; add \`.editor("color")\` for a color editor.
- \`p.number()\` yields \`number\`.
- \`p.boolean()\` yields \`boolean\`.
- \`p.select(["a", "b"] as const)\` yields the option union. Options must be non-empty.
- \`p.image()\` yields an image URL/asset reference string.
- \`p.ref("product")\` yields a resolved \`PaywallProduct\` in \`render\`.
- \`p.component()\` yields a nested \`ReactNode\` controlled by the editor.
- \`p.array(item)\` yields a homogeneous array; \`item\` cannot itself be an array. Arrays of
  ref/component items compile, but Studio treats them as code-configured/read-only.
- \`.localizable()\` is legal only on string and image props.

A default makes a prop optional to the instance but always populated in \`render\`.
An explicitly optional prop is \`T | undefined\` in \`render\`. Use only JSON-safe scalar or
scalar-array defaults; ref/component defaults do not survive the manifest. Never name a
prop or action \`id\`; it is reserved for document node identity. Use the exact \`Slot\`
identifier and supported product-hook names because manifest slot/host-data detection is
source-based; renamed imports and product hooks hidden in helpers outside \`render\` may not
be detected.

### Actions

- \`a.action()\` declares \`() => void\`.
- \`a.action({ field: a.string(), count: a.number(), enabled: a.boolean() })\` declares a
  typed payload callback.
- Payloads are flat scalar records only.

Pass a payload-free action directly to \`Pressable\` when possible. Wrap a payload action so
the component supplies its payload. Declared action callbacks are stable and become no-ops
when an instance has no matching binding. An instance's \`actionBindings\` may bind emitted
fields to literals, variables, or action-payload fields and may perform \`set-variable\`,
\`purchase-product\`, \`close-paywall\`, or \`none\` according to the document schema.

### Previews and slots

Preview names must match \`[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}\`. With no declarations, an
implicit \`default\` preview is rendered. \`props\` override declared defaults. \`data\` accepts
\`products\` and \`variables\`; product refs fall back to the first fixture product when unset.
Exercise meaningful visual branches with named previews and keep fixture data complete.

Use at most one \`<Slot />\`. It renders document children supplied to the component
instance; \`<Slot fallback={...} />\` renders the fallback only when no children were passed.
An empty Slot becomes a marker in the preview tree. More than one Slot collapses the
preview to an error placeholder. A component-node's children are its slot content.

## Render primitives, runtime, and styles

Import \`View\`, \`Text\`, \`Pressable\`, \`ScrollView\`, \`Image\`, and \`Slot\` from
\`@voidhash/paywalls\`.

- \`View\`: flex container; supports visual motion and drag.
- \`Text\`: text content; supports visual motion, \`numberOfLines\`, test id, and accessibility
  label; never draggable.
- \`Pressable\`: tap/keyboard surface; supports visual motion, press/focus states, drag,
  \`disabled\`, and either static children or \`(state: { pressed }) => ReactNode\`.
- \`ScrollView\`: vertical by default, horizontal with \`horizontal\`; supports visual motion,
  \`contentContainerStyle\`, and a motion ref; never draggable.
- \`Image\`: requires \`source\` as a string or \`{ uri }\`; \`resizeMode\` is \`cover\`, \`contain\`,
  \`stretch\`, or \`center\`; supports visual motion and drag.

\`testID\` is available on \`View\`, \`Text\`, \`Pressable\`, \`ScrollView\`, and \`Image\`.
All except \`ScrollView\` also accept \`accessibilityLabel\`. \`id\`/\`name\` on \`View\` and
\`Text\` are inert annotations, and \`View.onPress\` is inert; use \`Pressable\` for runtime
interaction. A ScrollView's \`contentContainerStyle\` accepts static style only.

Styles accept a single object or nested arrays with falsy entries; later entries win.
Use React Native-style longhands, not CSS or shorthand spacing/borders. Numbers are logical
pixels; dimensions may also be strings such as \`"50%"\`.

Supported static keys are:

\`flex\`, \`flexDirection\`, \`alignItems\`, \`alignSelf\`, \`justifyContent\`, \`flexWrap\`, \`gap\`,
\`flexGrow\`, \`flexShrink\`, \`flexBasis\`, \`width\`, \`height\`, \`minWidth\`, \`minHeight\`,
\`maxWidth\`, \`maxHeight\`, \`paddingTop\`, \`paddingBottom\`, \`paddingLeft\`, \`paddingRight\`,
\`marginTop\`, \`marginBottom\`, \`marginLeft\`, \`marginRight\`, \`aspectRatio\`,
\`borderTopWidth\`, \`borderRightWidth\`, \`borderBottomWidth\`, \`borderLeftWidth\`,
\`borderColor\`, \`borderTopLeftRadius\`, \`borderTopRightRadius\`,
\`borderBottomLeftRadius\`, \`borderBottomRightRadius\`, \`borderStyle\`, \`backgroundColor\`,
\`backgroundType\`, \`backgroundGradient\`, \`backgroundImage\`, \`opacity\`, \`overflow\`,
\`position\`, \`top\`, \`right\`, \`bottom\`, \`left\`, \`zIndex\`, \`color\`, \`fontSize\`,
\`fontWeight\`, \`fontStyle\`, \`lineHeight\`, \`letterSpacing\`, \`textAlign\`, \`textTransform\`,
\`textDecorationLine\`, and \`fontFamily\`.

Value unions: \`flexDirection\` is \`row | row-reverse | column | column-reverse\`;
\`alignItems\` is \`flex-start | flex-end | center | stretch | baseline\`; \`alignSelf\` also
allows \`auto\`; \`justifyContent\` is \`flex-start | flex-end | center | space-between |
space-around | space-evenly\`; \`flexWrap\` is \`wrap | nowrap | wrap-reverse\`; \`borderStyle\`
is \`solid | dotted | dashed\`; \`overflow\` is \`visible | hidden | scroll\`; and \`position\` is
\`absolute | relative\`. \`fontStyle\` is \`normal | italic\`; \`textAlign\` is \`auto | left |
right | center | justify\`; \`textTransform\` is \`none | uppercase | lowercase | capitalize\`;
and \`textDecorationLine\` is \`none | underline | line-through | underline line-through\`.
\`fontWeight\` accepts a number, \`normal\`, \`bold\`, or the strings \`100\` through \`900\`.

For structured backgrounds, set \`backgroundType\` to \`solid\`, \`gradient\`, or \`image\`.
A gradient is \`{ kind, startX, startY, endX, endY, stops: [{ color, position }] }\` with
\`kind\` \`linear\` or \`radial\`. An image is \`{ url, resizeMode }\`. Do not use arbitrary CSS,
\`transform\`, shorthand \`padding\`, shorthand \`margin\`, shorthand \`borderWidth\`, or
\`borderRadius\`; motion transforms use the motion keys below.

Runtime hooks:

- \`usePaywallProducts()\` returns \`readonly PaywallProduct[]\`.
- \`useSelectedProduct()\` returns \`selectedProduct\`, \`selectedProductId\`, and
  \`selectProduct(productId)\`.
- \`usePaywallVariables()\` returns \`Record<string, string | number | boolean>\`.
- \`usePaywallActions()\` returns \`purchase(productId?)\`, \`restore()\`, \`close(reason?)\`,
  \`openUrl(url)\`, \`track(name, properties?)\`, and \`selectProduct(productId)\`.
- \`usePaywallStatus()\` returns status \`idle\`, \`purchasing\`, \`purchased\`, \`restoring\`,
  \`restored\`, \`cancelled\`, or \`failed\`, plus optional \`productId\` and an optional error
  containing \`code\` and \`message\`.
- \`usePaywallConfig()\` returns products, variables, locale, platform, and optional default
  selected product id. Platform is \`ios | android | web\`.

The selected product defaults to \`defaultSelectedProductId\`, then the first product.
\`purchase()\` uses that selection when no id is passed and warns/no-ops if no product exists.

\`PaywallProduct\` contains \`id\`, \`slug\`, \`displayName\`, optional \`description\`, optional
numeric \`price\`, \`priceString\`, optional \`currencyCode\`, optional \`period\` (\`month\`,
\`year\`, \`week\`, \`lifetime\`), and optional \`trialPeriod\`. Also import \`useState\`,
\`useEffect\`, \`useMemo\`, \`useCallback\`, and \`useRef\` from \`@voidhash/paywalls\`.

## Custom designer panels

Import \`Panel\` from \`@voidhash/paywalls/panel\`. Return exactly one \`<Panel>\` root from the
\`panel(ctx)\` function. The definition runs as a long-lived React session, so hooks, state,
effects, and timers work. Its output is serialized to a closed JSON-safe tree; functions
never cross the sandbox boundary. Events are routed back to the current handler by node id
and event name. A recompile or component-identity change remounts the panel and resets its
local state.

### Panel context and safe editing

\`ctx.selection.count\` reports the number of homogeneous component instances being edited.
\`ctx.data.products\` and \`ctx.data.variables\` contain host data when available; do not assume
either is populated.

Current Studio custom sessions send \`products: []\` and \`variables: {}\`. Consequently a
custom \`ctx.props.<ref>.set(productId)\` is rejected until a synchronous product source is
wired. Use \`Panel.PropField\` for product refs and variable-binding chrome; it expands through
the host and does not depend on this sandbox data.

For scalar, select, image, and writable array props, \`ctx.props.name\` contains:

- \`value: T | undefined\`, \`mixed: boolean\`, \`bound: boolean\`, and \`kind\`.
- \`set(value, { gesture?: "live" | "commit" })\`; omitted gesture means \`commit\`.
- \`cancel()\` to discard an in-flight live gesture.
- \`reset()\` to remove the override and return to the declared default.

Never call \`set\` or \`reset\` when \`bound\` is true; the host drops the write because variable
binding owns the value. Render \`Panel.PropField\` or \`Panel.DefaultProps\` to retain the
host's binding/localization/reset chrome. For multi-selection, pass \`mixed\` into controls
and avoid presenting one target's value as unanimous.

A ref handle contains \`value: PaywallProduct | undefined\`, \`productId\`, \`mixed\`, \`kind:
"ref"\`, and \`set(productId)\`. A component prop handle is read-only (\`value\`, \`mixed\`,
\`kind\`). Prefer \`Panel.PropField\` for ref, component, localized, and variable-bound props;
the host owns their complete editor behavior and may not inject products into a custom
session synchronously.

### Panel primitives

Shared tokens:

- gap: \`none | xs | sm | md | lg\`; width: \`auto | full | half\`.
- align: \`start | center | end | stretch\`; justify: \`start | center | end | between\`.
- text variant: \`label | body | caption | heading\`.
- tone: \`default | muted | info | warning | error\`.
- button variant: \`default | outline | ghost | destructive\`; size: \`sm | icon-sm | default\`.
- option: \`{ value, label?, icon?, disabled? }\`.

Layout and chrome:

- \`Panel\` root; \`Panel.Section({ title?, collapsible?, defaultCollapsed?, onToggle? })\`;
  \`Panel.SectionActions\`; \`Panel.Subsection({ title? })\`.
- \`Panel.Row({ gap?, width?, align?, justify? })\`; \`Panel.Column({ gap?, width?, align? })\`;
  \`Panel.Field({ label?, icon? })\`.
- \`Panel.Text({ content?, variant?, tone? })\` and
  \`Panel.Callout({ message?, tone? })\` use props, not JSX text children.
- \`Panel.Popover({ open?, onOpenChange? })\`, \`Panel.PopoverTrigger\`, and
  \`Panel.PopoverContent({ align?, side? })\` compose a popover.
- \`Panel.Menu({ items?, value?, align?, onSelect? })\` renders a host dropdown.

Basic controls:

- \`Panel.TextField({ kind?, value?, mixed?, placeholder?, min?, max?, step?, icon?,
  disabled?, trailingMenu?, onChange?, onCommit?, onTrailingSelect? })\`. Event values are
  strings; parse numeric text when necessary.
- \`Panel.SelectField({ value?, options?, placeholder?, mixed?, disabled?, onChange? })\`.
- \`Panel.ToggleGroup({ value?, options?, mixed?, disabled?, onChange? })\`.
- \`Panel.SwitchField({ checked?, mixed?, label?, disabled?, onChange? })\`.
- \`Panel.Button({ label?, icon?, variant?, size?, disabled?, onClick? })\`.
- \`Panel.SliderField({ value?, min?, max?, step?, mixed?, disabled?, onChange?,
  onCommit? })\`.
- \`Panel.ResetAffordance({ show?, label?, onReset?, children? })\`.

Host-integrated composites:

- \`Panel.ColorField({ value?, mixed?, mixedLabel?, disabled?, onChange?, onDragStart?,
  onCommit?, onDiscard? })\`.
- \`Panel.ColorPicker({ color?, opacity?, onColorChange?, onOpacityChange?, onDragStart?,
  onDragEnd?, onDiscard? })\`.
- \`Panel.GradientStops({ stops?, selectedStopId?, onSelect?, onAddStop?, onMoveStop?,
  onRemoveStop?, onDragStart?, onDragEnd?, onDiscard? })\`.
- \`Panel.Swatch({ color?, imageUrl? })\`; \`Panel.ImageField({ url?, resizeMode?, onPick?,
  onResizeModeChange?, onClear? })\`.
- \`Panel.AlignmentGrid({ flexDirection?, alignItems?, justifyContent?, mixed?, onChange? })\`.
- \`Panel.DimensionField({ axis?, mode?, value?, label?, mixed?, disabled?, computed?,
  onChange?, onCommit?, onModeChange? })\`.
- \`Panel.FillField({ label?, backgroundType?, isTypeMixed?, backgroundColor?, gradient?,
  selectedStopIndex?, image?, open?, onTypeChange?, onColorChange?, onGradientChange?,
  onStopColorChange?, onStopPositionChange?, onAddStop?, onAddStopAt?, onRemoveStop?,
  onSelectStop?, onImageUrlChange?, onImageResizeModeChange?, onGestureStart?, onCommit?,
  onDiscard?, onOpenChange? })\`. Keep at most eight handlers on one node; normally use the
  write-bearing set \`onTypeChange\`, \`onColorChange\`, \`onGradientChange\`,
  \`onImageUrlChange\`, \`onImageResizeModeChange\`, \`onGestureStart\`, \`onCommit\`, and
  \`onDiscard\`.
- \`Panel.VariableField({ variableId?, variableName?, variableType?, allowedKinds?, label?,
  onBind?, onUnbind?, onCreate? })\`.
- \`Panel.ActionEditorField({ value?, variables?, productVariables?, payloadFields?,
  onChange? })\`.
- \`Panel.ProductField({ productId?, placeholder?, disabled?, label?, onChange? })\`.
- \`Panel.PropField({ name })\` expands one manifest prop through the full host editor.
- \`Panel.DefaultProps({ exclude? })\` expands all manifest props except the exclusions.

Composite callbacks do not grant extra host authority. In particular, \`VariableField\` and
\`ActionEditorField\` only emit their declared callbacks; use host-expanded prop rows for
actual component prop binding, localization, reset, and product selection.

Use only these icon tokens:
\`w\`, \`h\`, \`a\`, \`plus\`, \`minus\`, \`x\`, \`trash\`, \`pencil\`, \`search\`, \`settings\`, \`info\`,
\`alert\`, \`image\`, \`imagePlus\`, \`pipette\`, \`percent\`, \`diamond\`, \`square\`, \`squareDashed\`,
\`squareRoundCorner\`, \`squareRoundCornerTopLeft\`, \`squareRoundCornerBottomLeft\`,
\`squareRoundCornerBottomRight\`, \`squareDashedTopSolid\`, \`squareDashedTopSolidLeft\`,
\`squareDashedTopSolidRight\`, \`squareDashedTopSolidBottom\`, \`type\`, \`component\`, \`code\`,
\`eye\`, \`paintbrush\`, \`chevronDown\`, \`chevronRight\`, \`chevronUp\`, \`arrowDown\`,
\`arrowRight\`, \`arrowUpCircle\`, \`rotateCw\`, \`rotateCcw\`, \`flipHorizontal\`, \`undo\`, \`redo\`,
\`save\`, \`fullscreen\`, \`scan\`, \`vault\`, \`panelLeftDashed\`, \`panelRightDashed\`,
\`panelTopDashed\`, \`panelBottomDashed\`, \`panelLeftRightDashed\`, \`panelTopBottomDashed\`,
\`betweenHorizontalStart\`, \`user\`, \`users\`, \`externalLink\`, and \`mousePointer\`.

Panel limits are 256 KiB per tree, 2,000 nodes, depth 32, 4,096 characters per string,
256 options per select/toggle/menu, 64 gradient stops, eight event names per node, and
32 KiB per emitted prop value. The host also validates values against the component
manifest, rejects unknown/read-only/bound props, limits arrays to 200 items, rate-limits
the intent stream, and coalesces live writes per prop per frame.

Panel trees are coalesced to the latest revision once per animation frame. The sandbox has
a 6-second init deadline, a 2.5-second heartbeat, allows two missed pongs, kills tree
streams above 120/second, caps intents at 240/second, and permits two automatic restarts
with 400 ms backoff. A terminal failure switches to the default prop panel with a retry
control.

### Panel gesture pattern

Use committed writes for text/select/switch/button edits. For continuous controls, send
live values during movement, a final committed value on release, and cancel on abort:

\`\`\`tsx
<Panel.SliderField
  value={ctx.props.radius.value}
  mixed={ctx.props.radius.mixed}
  min={0}
  max={32}
  onChange={(value) => ctx.props.radius.set(value, { gesture: "live" })}
  onCommit={(value) => ctx.props.radius.set(value, { gesture: "commit" })}
/>
\`\`\`

The first live write opens a host draft; live writes are transient/coalesced, and the end
commits one undoable edit. \`cancel()\` discards the in-flight draft. A selection change,
session failure, or 10 seconds of inactivity also discards an unfinished gesture. Keep the
control's display value derived from the latest \`ctx\` snapshot; the host protects an active
control from stale sandbox echoes during a drag.

## Runtime animation and gestures

### Motion targets, variants, and transitions

Every motion-capable primitive (\`View\`, \`Text\`, \`Pressable\`, \`ScrollView\`, and \`Image\`)
accepts \`initial\`, \`animate\`, \`variants\`, \`transition\`, \`whileInView\`, \`viewport\`,
\`onAnimationStart\`, and \`onAnimationComplete\`. \`Pressable\` also accepts
\`whilePress\`/\`whileFocus\`; draggable primitives accept \`whileDrag\`.

Motion targets support only \`x\`, \`y\`, \`scale\`, \`scaleX\`, \`scaleY\`, \`rotate\` (degrees),
\`opacity\`, \`backgroundColor\`, and \`transformOrigin\` (\`{ x, y }\` fractions of the box).
Put these keys directly in \`style\` for motion values or in a target. Do not use a CSS
\`transform\` string.

Use inline targets or named variants:

\`\`\`tsx
<View
  variants={{ hidden: { opacity: 0, y: 20 }, shown: { opacity: 1, y: 0 } }}
  initial="hidden"
  animate="shown"
  transition={{
    default: { type: "spring", stiffness: 220, damping: 24 },
    opacity: { type: "tween", duration: 0.2, ease: "easeOut" },
  }}
/>
\`\`\`

A variant label array merges labels left-to-right. Literal motion style is the base;
\`animate\` overrides it at rest. Active interaction targets overlay in this order:
in-view, press, focus, drag, so later states win conflicting keys. \`initial={false}\` mounts
at rest. Define a numeric value in both start and target states if it must interpolate;
non-numeric motion values such as colors and transform origins currently snap.

Transforms compile in this fixed order: translate (\`x\`/\`y\`), rotate, \`scale\`, \`scaleX\`,
then \`scaleY\`.

Transitions use seconds. \`type\` is \`tween\` or \`spring\`; shared fields are \`delay\`,
\`duration\`, \`ease\` (\`linear\`, \`easeIn\`, \`easeOut\`, \`easeInOut\`), \`stiffness\`, \`damping\`,
\`mass\`, \`velocity\`, \`restDelta\`, and \`restSpeed\`. Defaults are a 0.3-second linear tween,
or a spring with stiffness 170, damping 26, mass 1, rest delta/speed 0.01. A transition may
contain per-key overrides plus \`default\`. \`MotionConfig\` supplies inherited transition and
\`reducedMotion: "user" | "always" | "never"\`; reduced motion jumps to targets and still
fires completion. \`useMotionConfig()\` reads the inherited policy/default transition, and
\`useReducedMotion()\` resolves it to a boolean using the platform preference. An interrupted
animation is canceled and does not fire its old completion callback.

Static previews never run live animation. They serialize the deterministic rest state
(\`animate\`, else \`initial\`, over literal motion style), omit live motion values, render
Pressable children unpressed, and flatten scroll content. Design the rest state to be
complete and readable.

The \`AnimationControls\` type is reserved for imperative control, but there is currently no
author-facing controls factory/binding. Use declarative \`animate\`/variants or motion values.

### Motion values

- \`useMotionValue(initial)\` creates a stable mutable value whose updates bypass React.
- \`motionValue(initial)\` creates one outside React; \`get\`, \`getPrevious\`, \`set\`, and
  \`on("change" | "renderRequest", listener)\` form its protocol.
- \`useMotionValueEvent(value, event, listener)\` subscribes without React frame renders.
- \`useTransform(source, fn)\` derives any mapped value. The numeric range overload maps
  equal-length input/output arrays and clamps to the covered range.
- \`useSpring(source, transition)\` follows a numeric source with an interruptible spring.
- \`useVelocity(source)\` returns logical units per second.

Pass a motion value through a supported motion style key:

\`\`\`tsx
const { scrollYProgress } = useScroll();
const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.4, 1, 0.4]);
return <View style={{ opacity }} />;
\`\`\`

A live motion value drives a key only when the resolved animation/interaction target does
not also define that key. Target values win; reduced-motion mode also suppresses live style
updates. Static previews omit motion values entirely.

### Scroll and in-view

Create renderer-neutral refs with \`useMotionRef()\` and attach them to motion-capable primitives.
\`useScroll({ container?, target?, axis?, offset?, trackLayout? })\` returns \`scrollX\`,
\`scrollY\`, \`scrollXProgress\`, and \`scrollYProgress\` motion values. Without a container it
tracks the root window. Without a target, progress is total scroll progress. With a target,
the default offsets are \`["start end", "end start"]\`; anchors accept \`start\`, \`center\`,
\`end\`, percentages, or numeric strings. Use \`trackLayout\` when changing layout affects the
measurement. \`axis\` defaults to \`y\`; with a target, only the selected axis's progress value
is updated.

\`useInView(ref, { root?, once?, amount?, margin? })\` returns a boolean. \`amount\` is a
number, \`some\` (1% threshold), or \`all\`; \`once\` stays true after first entry. \`whileInView\`
uses the same viewport contract. Omitted \`amount\` currently uses a zero threshold, which
counts zero overlap as in view; pass \`"some"\` or a positive number for actual intersection.
The current DOM adapter accepts \`margin\` in the public shape but does not apply it; do not
rely on margin-sensitive behavior.

\`ScrollView\` refs additionally expose \`getScrollMetrics()\`, \`scrollTo({ x?, y? })\`, and
\`subscribeScroll\`. Measurements use the untransformed layout box.

### Drag gestures

Drag is supported only by \`View\`, \`Image\`, and \`Pressable\`.

- \`drag={true}\` allows both axes. \`"x"\` or \`"y"\` limits which dominant direction may
  claim the gesture; in the current DOM adapter, also enable \`dragDirectionLock\` to keep
  post-claim displacement strictly on that axis.
- \`dragConstraints\` accepts \`{ left?, right?, top?, bottom? }\` relative to the starting
  motion position, or a \`MotionRef\` whose measured box bounds the draggable node.
- \`dragElastic\` is \`0.35\` by default, \`false\` for no overshoot, or a numeric factor.
- \`dragMomentum\` defaults true. Release projects velocity by 0.2 seconds, clamps it to
  constraints, and animates to the result with \`{ type: "spring", ...dragTransition }\`;
  supplied transition fields, including \`type\`, override the default. Set false to stop at
  the release position.
- \`dragDirectionLock\` locks to the dominant axis after movement begins.
- \`gesturePriority="auto"\` lets a matching-axis ancestor ScrollView win; a cross-axis drag
  wins. Use \`"drag"\` only when the draggable must steal a matching-axis scroll gesture.
- \`dragListener={false}\` disables direct pointer start. It also enables registration of a
  supplied \`dragControls={useDragControls()}\`. \`controls.start(event, options)\` requires a
  \`MotionGestureEvent\`; options are \`{ snapToCursor?, distanceThreshold? }\`. Authored
  primitives expose no raw pointer-down event and the current DOM adapter ignores both
  options, so prefer the built-in listener.
- \`onDragStart\`, \`onDrag\`, and \`onDragEnd\` receive a platform-neutral event and \`DragInfo\`:
  current \`point\`, last-event \`delta\`, start-relative \`offset\`, and logical-units-per-second
  \`velocity\`.

A drag claims the gesture after roughly three logical pixels. On a Pressable, claiming a
drag clears the pressed state and suppresses the following click. \`whilePress\` begins on
pointer down and clears on leave/up/cancel; \`whileFocus\` follows keyboard focus. Enter and
Space activate a focused Pressable. There is no \`whileHover\`, keyframe/timeline API, layout
animation, arbitrary transform string, or draggable Text/ScrollView in the current surface.

## Final verification checklist

- Keep the component as small as the code-only behavior permits.
- Use a valid, unique path and default-export the \`defineComponent\` result.
- Declare every editable input and emitted event; avoid reserved \`id\`.
- Provide preview fixtures for product/runtime branches and use no more than one Slot.
- Use only supported primitives, style keys, motion keys, imports, and panel nodes.
- Preserve mixed/bound semantics and use gesture-aware panel writes correctly.
- Respect reduced motion and make the static rest state complete.
- Re-read compiler diagnostics instead of guessing, inspect the rendered paywall PNG, and
  finish or revert the edit session explicitly.
`;

/** Returns the complete code-component authoring skill body. */
export const componentAuthoringSkill = (): string => COMPONENT_AUTHORING_SKILL;
