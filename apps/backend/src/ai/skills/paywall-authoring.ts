import { ALLOWED_CHILDREN_BY_NODE_TYPE, NODE_TYPES, type NodeType } from "@voidhash/mimic-schema";
import {
  acceptanceOf,
  nodeDefaultData,
  nodeStyleFields,
  nodeStyleSchema,
  STYLE_GROUP_FLAG_BY_FIELD,
  type SerializedSchema,
} from "@voidhash/ai-shared";

/**
 * Authoring guide appended to the designer-surface system prompt. The document
 * model, containment rules, and the entire style reference are GENERATED from the
 * live mimic schemas at module load (never hand-listed) — the drift-killer at the
 * heart of the document-first authoring redesign. The code-component half is
 * hand-written prose (that grammar lives outside the mimic node schemas).
 *
 * Rendering pipeline (see the generators below): read the mimic node primitives
 * via ai-shared's schema introspection → for each covered node type, enumerate
 * its style fields with their value family (enum literals / number / color /
 * string / object) and schema default → format as a compact per-field list. The
 * containment lines come straight from `ALLOWED_CHILDREN_BY_NODE_TYPE`.
 */

/**
 * A short value-type label for a style field, derived from its serialized schema.
 * Enums enumerate their literal set; a field whose name marks it a color renders
 * `color` (colors are plain strings in the schema, indistinguishable by shape);
 * structured fields render `object`; scalars render their family.
 */
function styleValueLabel(field: string, schema: SerializedSchema): string {
  const acc = acceptanceOf(schema);
  if (acc.literals.length > 0 && !acc.acceptsNumber && !acc.acceptsString && !acc.acceptsBoolean) {
    return acc.literals.map((literal) => JSON.stringify(literal)).join(" | ");
  }
  if (acc.isStructured) return "object";
  // Colors are `rgba(r, g, b, a)` strings — the schema can't distinguish them
  // from a free string, so key off the field name (the only reliable signal).
  if (/color$/i.test(field)) return "color (rgba)";
  const families: string[] = [];
  if (acc.acceptsNumber) families.push("number");
  if (acc.acceptsString) families.push("string");
  if (acc.acceptsBoolean) families.push("boolean");
  return families.join(" | ") || "unknown";
}

/**
 * The `<group>Enabled` flag fields the AI edit path AUTO-MANAGES (derived from the
 * group-flag map, not hand-listed). Setting any field of a gated style group
 * (background / border / shadow / fill / stroke) turns its flag on automatically.
 */
const AUTO_MANAGED_FLAG_FIELDS: ReadonlySet<string> = new Set(
  Object.values(STYLE_GROUP_FLAG_BY_FIELD),
);

/**
 * The AUTO-MANAGED annotation for a `<group>Enabled` flag field, telling the model
 * it never needs to set the flag on and that its only use is an explicit `false`
 * to hide the group without deleting the group's fields.
 */
function autoManagedAnnotation(flagField: string): string {
  const group = flagField.replace(/Enabled$/, "");
  return ` — AUTO-MANAGED: set to true automatically when you set any ${group} field; write \`false\` explicitly to hide the ${group} without deleting its fields.`;
}

/** The schema default for one style field of a node type, or `undefined` if it has none. */
function styleFieldDefault(type: NodeType, field: string): unknown {
  const style = nodeDefaultData(type)["style"];
  return style && typeof style === "object" ? (style as Record<string, unknown>)[field] : undefined;
}

/**
 * Render one node type's full style reference as a compact block: one line per
 * style field with its value family and default. Every field the schema declares
 * is listed (that is what the contract test guards) — so the model sees the
 * designer-internal fields (`backgroundEnabled`, `safeAreaTop`, …) too, which is
 * the whole point of generating from the schema.
 */
function renderStyleReference(type: NodeType): string {
  const styleSchema = nodeStyleSchema(type);
  const fields = nodeStyleFields(type);
  if (styleSchema === undefined || fields.length === 0) {
    return `\`${type}\` has no style fields.`;
  }
  const lines = fields.map((field) => {
    const label = styleValueLabel(field, styleSchema.fields[field]!);
    const defaultValue = styleFieldDefault(type, field);
    const defaultText =
      defaultValue === undefined ? "no default" : `default ${JSON.stringify(defaultValue)}`;
    const annotation = AUTO_MANAGED_FLAG_FIELDS.has(field) ? autoManagedAnnotation(field) : "";
    return `- \`${field}\`: ${label} (${defaultText})${annotation}`;
  });
  return lines.join("\n");
}

/** The node types whose style reference ships in the prompt (every styled editable node). */
const STYLE_REFERENCE_NODE_TYPES: readonly NodeType[] = ["screen", "view", "text", "shape", "path"];

/** The full generated style reference: one section per styled node type. */
const styleReference = (): string =>
  STYLE_REFERENCE_NODE_TYPES.map(
    (type) => `### \`${type}\` style fields\n\n${renderStyleReference(type)}`,
  ).join("\n\n");

/**
 * The generated containment listing: for each node type, the node types it may
 * legally contain (from `ALLOWED_CHILDREN_BY_NODE_TYPE`). A leaf (no legal
 * children) is stated as such. Only the types the model authors are listed
 * (`library`/`codeComponent`/`root` are engine-managed).
 */
const AUTHORABLE_PARENT_TYPES: readonly NodeType[] = NODE_TYPES.filter(
  (type) => type !== "root" && type !== "library" && type !== "codeComponent",
);

const CONTAINMENT_REFERENCE = AUTHORABLE_PARENT_TYPES.map((type) => {
  const children = ALLOWED_CHILDREN_BY_NODE_TYPE[type];
  return children.length > 0
    ? `- \`${type}\` may contain: ${children.map((child) => `\`${child}\``).join(", ")}`
    : `- \`${type}\` is a leaf (no child nodes).`;
}).join("\n");

let cachedSkill: string | undefined;

/**
 * Assembled skill body — static prose interleaved with the generated references.
 * Lazy + memoized, never a module-level string: rendering the style reference
 * computes schema defaults, which encodes entry-wrapped arrays whose
 * fractional-index keys are jitter-randomized — and workerd forbids generating
 * random values in global scope, so the skill must be built on first use inside
 * a request handler.
 */
export const paywallAuthoringSkill = (): string =>
  (cachedSkill ??= `# Paywall Authoring Reference

This is the domain reference for building the open paywall as a mimic document
with \`edit_document\`, plus code components for anything that needs real code.
Read the document model and containment rules first — the style reference below is
generated from the live schema, so it is always exact.

## Document model

A paywall is a MIMIC DOCUMENT: a tree of nodes. You author it with \`edit_document\`
ops (\`insert\`, \`update\`, \`move\`, \`remove\`, \`replaceChildren\`), addressing nodes
by their engine-minted id. The node kinds you build with:

- \`screen\` — the paywall's root visual frame (the top-level node under the
  document). Holds the whole layout; has a background, safe-area flags, and a
  fixed default size (375×812).
- \`view\` — a flex container / row / column. The workhorse for layout, grouping,
  cards, buttons (a \`view\` with an \`onPress\` interaction is a tappable surface —
  there is no separate button/pressable node).
- \`scrollView\` — a \`view\` that SCROLLS. Same style/children as a \`view\`; use it
  for content taller than the screen. \`horizontal: true\` scrolls sideways and lays
  its children out in a row (forces row flow, like RN); \`showsScrollIndicator: false\`
  hides the scrollbar.
- \`text\` — a text leaf. Its \`text\` data field is the literal string it renders.
- \`shape\` — a vector container that holds \`path\` nodes (for icons / custom
  vector art).
- \`path\` — a single vector path inside a \`shape\`.
- \`component\` — an INSTANCE of a catalog component, a local code component, or a
  first-party BUILTIN that ships with the renderer. Insert one to place a reusable
  widget; bind its props/actions (discover them with \`get_components\`). Insert a
  builtin with \`componentSource: "builtin"\` and its \`componentSlug\` from
  \`get_components\` — builtins are UNPINNED (no version/hash) and take props like
  any component.

Node ids are ADDRESSES: every node has a stable id. \`get_document\` returns the
tree with ids; the user's selection is a set of ids; inserts RETURN their minted
ids. You never write an id yourself.

### Containment (which node may hold which)

An \`insert\`/\`move\` into a parent that cannot contain the node type is rejected.
The legal parent → child rules (generated from the schema):

${CONTAINMENT_REFERENCE}

## Style reference (generated from the schema)

Style is a per-node \`style\` object of RN-named fields (NO shorthands: write
\`paddingTop\`/\`paddingRight\`/… never \`padding\`; \`borderTopLeftRadius\`/… never
\`borderRadius\`). Colors are \`rgba(r, g, b, a)\` strings. Each node type accepts a
different subset; a field not listed for a node type is rejected on it.

**Group flags are AUTO-MANAGED.** Setting ANY background / border / shadow (or, on
\`path\`, fill / stroke) field automatically turns that group's \`<group>Enabled\`
flag on — just set \`backgroundColor\` and the background renders; you never write
\`backgroundEnabled: true\`. The \`*Enabled\` flags below exist ONLY for non-destructive
hiding: the sole reason to write one yourself is \`false\` (e.g.
\`{ backgroundEnabled: false }\`) to hide a group while keeping its fields for later.

Set a style field via \`update\` with merge semantics: \`set: { style: { paddingTop: 8 } }\`
changes ONLY \`paddingTop\` and leaves every other style field untouched. To insert
a node with styles, put the \`style\` object on the inserted node.

${styleReference()}

### Flex layout (defaults match CSS)

Layout is flexbox, exactly like CSS / React Native:

- Views **hug their content** by default: \`width\` and \`height\` default to
  \`"auto"\`. Do NOT set a numeric \`width\`/\`height\` just to "make it fit" — omit
  them and let flex size the node. Set a number only for a genuinely fixed size.
- A container **stretches its children on the CROSS axis** by default
  (\`alignItems\` defaults to \`"stretch"\`). So a child of a \`column\` fills the
  container's width, and a child of a \`row\` fills its height, automatically —
  you do not need \`alignSelf\` or a width/height for that.
- To make a child **fill the MAIN axis** (grow to share leftover space), give it
  \`flex: 1\` (e.g. a spacer, or two side-by-side cards that split a row).
- Cross-axis fill is automatic UNLESS the child opts out — either a numeric size
  on that axis (a fixed size defeats stretch) or a non-\`stretch\` \`alignSelf\`
  (\`"flex-start"\`/\`"center"\`/\`"flex-end"\`). Set \`alignSelf\` only to deviate from
  the container's alignment.
- Prefer omitting \`width\`/\`height\` and reaching for \`flexDirection\`, \`gap\`,
  \`justifyContent\` (main axis), \`alignItems\` (cross axis), and \`flex\` to compose
  layout — the same tools you would use in CSS.

### Structured style values (gradient / image backgrounds)

\`backgroundGradient\` and \`backgroundImage\` are objects. Set
\`backgroundType: "gradient"\` (or \`"image"\`) for the chosen fill to render
(\`backgroundEnabled\` is turned on automatically for you).

\`\`\`json
// backgroundGradient
{ "kind": "linear", "startX": 0.5, "startY": 0, "endX": 0.5, "endY": 1,
  "stops": [ { "color": "rgba(255,255,255,1)", "position": 0 },
             { "color": "rgba(255,255,255,0)", "position": 1 } ] }
// backgroundImage
{ "url": "https://…", "resizeMode": "cover" }  // cover | contain | stretch | center
\`\`\`

## Tool usage

- **\`get_document\` first.** Learn the current tree and ids before editing. Pass
  \`nodeId\` to root at a subtree and \`depth\` to cap the tree (deeper nodes return
  as \`{ id, type, name?, childCount }\` stubs you expand with a follow-up
  \`get_document(nodeId)\`). Cheaper than pulling the whole document every turn.
- **\`edit_document\` applies an ATOMIC batch.** Every op lands or none does. On
  success you get the minted ids for \`insert\`/\`replaceChildren\` ops (keyed by op
  index, parents-before-children) so you can address new nodes next. On failure
  you get per-op errors naming the node, the allowed fields (with a did-you-mean),
  and the allowed values — trust them and correct the batch. On a write conflict
  the batch is re-applied against the latest LIVE tree, so concurrent designer
  edits MERGE rather than clobber — a follow-up \`get_document\` may show a tree
  shifted by another editor's changes.
- **Merge semantics on \`update\`.** \`set.style\` merges per style field; other
  objects merge per-field; arrays and scalars REPLACE wholesale. Send only the
  fields you want to change.
- **Ids are minted.** Never supply an id on an inserted node. Target existing
  nodes with ids from \`get_document\`, the selection, or a prior insert's returned
  ids.
- **Selection ids are directly addressable.** When the context block lists
  selected node ids, use them straight in ops (no need to re-locate them).
- **\`duplicate_subtree\` preserves visual systems.** Prefer it over rebuilding a
  repeated benefit, product option, card, or control from scratch. Fresh ids are
  returned, so immediately tailor the clone's content/state with focused updates.
- **\`get_rendered_layout\` measures reality.** Use it when declared styles are not
  enough to judge alignment, spacing, clipping, overflow, safe-area fit, or
  above-the-fold placement. It reports browser geometry and resolved styles.
- **\`get_preview_screenshot\` is the visual checkpoint.** Capture the screen after
  each meaningful visual section and after every correction pass. Inspect the
  pixels; do not infer visual quality from the document tree alone.
- **\`finish_design\` is the completion gate.** It accepts only the exact signature
  of the latest screenshot while the document is unchanged and
  \`unresolvedIssues\` is empty. Any post-review edit requires a new screenshot.

## Visual design and review workflow

For broad design work, decide on one coherent direction before editing: audience
and offer, visual mood, a restrained palette, typography scale, spacing rhythm,
content hierarchy, and CTA treatment. Build one meaningful visual group at a
time, then review it in the live screenshot. Prefer purposeful hierarchy and
consistent systems over adding decoration.

At every screenshot checkpoint, critique the rendered paywall against this
rubric and correct visible issues with focused edits:

- **Hierarchy and story:** the value proposition reads first, supporting proof
  and benefits scan naturally, and the primary CTA is unmistakably dominant.
- **Offer clarity:** product options, price/period, trial or billing terms, savings,
  and the selected state are understandable without guesswork.
- **Composition:** margins, gaps, alignment, radii, and repeated structures follow
  a consistent rhythm; no section feels accidentally crowded or empty.
- **Typography and color:** the type scale has clear roles, copy wraps cleanly,
  contrast is legible, and accents are reserved for meaningful emphasis.
- **Viewport fit:** no unintended clipping or horizontal overflow; safe areas are
  respected; the CTA and essential offer information are reachable and sensibly
  placed on the 375×812 screen.
- **Purchase affordances:** selectable options look selectable, the CTA looks
  tappable, and close, restore, legal, and subscription-term affordances are
  present when appropriate.
- **Polish:** imagery, icons, borders, shadows, and states render cleanly with no
  placeholders, awkward truncation, inconsistent styling, or accidental defaults.

Do not merely describe a problem found in the screenshot. Fix it, capture a new
screenshot, and repeat until the review has no unresolved issues. Then call
\`finish_design\` with the final screenshot's document signature.

### Op cheatsheet

- \`insert\` — add a subtree under \`parentId\` at \`index\` (append if omitted).
- \`update\` — partial data change on \`nodeId\` (\`set\`, merge semantics above).
- \`move\` — reparent \`nodeId\` under \`parentId\` at \`index\` (cycles/illegal
  containment rejected).
- \`remove\` — delete \`nodeId\` and its subtree.
- \`replaceChildren\` — swap \`nodeId\`'s whole child list for a new ordered one.

## Worked examples

### (a) Insert a screen's content in one batch

Add a header row and a title inside the screen \`scr_1\` (ids returned are used
implicitly by nesting the \`children\` inline):

\`\`\`json
{ "edits": [
  { "op": "insert", "parentId": "scr_1", "node": {
      "type": "view", "name": "Header",
      "style": { "flexDirection": "row", "justifyContent": "space-between", "alignItems": "center", "paddingTop": 16, "paddingBottom": 16 },
      "children": [
        { "type": "text", "name": "Title", "text": "Unlock Pro",
          "style": { "fontSize": 28, "fontWeight": "700", "color": "rgba(255,255,255,1)" } }
      ]
  } }
] }
\`\`\`

### (b) Restyle the selected node

The user has \`view_9\` selected and asks for a rounded indigo card. Change only
the fields you mean to (style merges per field):

\`\`\`json
{ "edits": [
  { "op": "update", "nodeId": "view_9", "set": { "style": {
      "backgroundColor": "rgba(99,102,241,1)",
      "borderTopLeftRadius": 12, "borderTopRightRadius": 12,
      "borderBottomRightRadius": 12, "borderBottomLeftRadius": 12,
      "paddingTop": 16, "paddingRight": 16, "paddingBottom": 16, "paddingLeft": 16 } } }
] }
\`\`\`

### (c) Insert a component instance and bind it

First \`get_components\` to read the component's path/slug, props, and actions.
Then insert a \`component\` node. A \`component\` node's identity fields select which
component to place; \`props\` binds its inputs and interactions/actions wire its
outputs. Read the exact prop/action names from \`get_components\` (they differ per
component) and follow the shapes the tool reports — do not assume field names.
Bind a purchase to the component's declared action via the same interaction model
as (d): a \`purchase-product\` action on the component's action slot.

### (d) Variables and interactions (what the document supports)

Variables and press interactions ARE first-class document data (on the node
\`localVariables\` / \`interactions\` fields), so you can wire simple behavior WITHOUT
a code component:

- **Local variables** live on \`screen\`/\`view\`/\`text\` as \`localVariables\`: an array
  of \`{ id, name, value }\` where \`value\` is a tagged union on \`key\`:
  \`{ key: "string", value }\` | \`{ key: "number", value }\` |
  \`{ key: "boolean", value }\` | \`{ key: "product", value: { productId? } }\`.
- **Interactions** live on \`view\` as \`interactions\`: an array of
  \`{ id, trigger, action }\`. The only trigger is \`{ type: "click" }\`. Actions:
  - \`{ type: "none" }\` — no-op.
  - \`{ type: "close-paywall" }\` — dismiss the paywall.
  - \`{ type: "purchase-product", payload: <productSource> }\` — start a purchase,
    where productSource is \`{ type: "literal", productId }\` or
    \`{ type: "variable-reference", variableId }\`.
  - \`{ type: "set-variable", payload: { variableId, newValue: <valueSource> } }\`
    where valueSource is \`{ type: "literal", value: <tagged value> }\` or
    \`{ type: "variable-reference", value: { id } }\`.

Make a \`view\` a purchase button by giving it an \`interactions\` array with a click
→ purchase-product action (set via \`update\`'s \`set: { interactions: [...] }\` —
arrays replace wholesale, so send the complete list):

\`\`\`json
{ "edits": [
  { "op": "update", "nodeId": "view_cta", "set": { "interactions": [
      { "id": "int_1", "trigger": { "type": "click" },
        "action": { "type": "purchase-product",
          "payload": { "type": "literal", "productId": "yearly" } } }
  ] } }
] }
\`\`\`

The \`id\` fields inside \`localVariables\`/\`interactions\`/gradient stops are your
own logical ids for those sub-records (NOT node ids) — mint stable strings.

## Doctrine: build with the document, reach for code only when you must

**The document (\`edit_document\`) is ALWAYS the primary way to build a paywall.**
Static layout, styling, literal text, local variables, and click interactions all
belong in the document. Write a code component ONLY when the document genuinely
cannot express what you need:

- **Mapping/looping** — one row per product, or any list built by iterating over
  runtime data (\`usePaywallProducts()\`).
- **Conditional / branching rendering** — element A vs B based on selection,
  status, a variable, or product shape.
- **Pressed / hover / focus visual states** — a button that changes color while
  pressed.
- **Animation.**
- **Custom formatting logic** — deriving "$5/mo billed yearly", percent savings,
  trial copy.
- **Runtime-data-bound text** — a \`text\` node renders a LITERAL string; it cannot
  interpolate a product price or a variable. Data-driven text needs a component.

### Decision checklist

1. Static layout + literal text? → **document** (\`screen\`/\`view\`/\`text\` nodes).
2. Text needs runtime data (price, count, formatting)? → code component for that
   text only.
3. A list produced by iterating products/data? → code component (map).
4. Branches on selection/status/variable? → code component.
5. Pressed/hover/animated visuals? → code component.
6. Otherwise → **document.** Prefer building with nodes.

When a code component IS needed, keep it **as small as possible** — one focused
interactive widget — then place it as a \`component\` node in the document.

## Code-component authoring (\`components/<name>.tsx\`)

A code component is a normal React component defined with \`defineComponent\` from
\`@voidhash/paywalls\`. Its identity is its path; a \`component\` node references it by
that path. Primitives, hooks, and full \`StyleProp\` arrays are all available here
(this is the escape hatch — real JS is allowed). Author it with \`write_component\`;
on success it compiles and becomes placeable, on failure you get compile
diagnostics to fix (the compile loop is internal to \`write_component\`).

\`\`\`tsx
import {
  defineComponent,
  View,
  Text,
  Pressable,
  Slot,
  useSelectedProduct,
} from "@voidhash/paywalls";
import type { PaywallProduct } from "@voidhash/paywalls";

export default defineComponent({
  title: "Product Option",
  description: "A selectable pricing row.",
  props: (p) => ({
    product: p.ref("product"),
    accentColor: p.string().editor("color").default("rgba(99, 102, 241, 1)"),
  }),
  actions: (a) => ({
    onSelect: a.action({ product: a.string() }),
  }),
  previews: {
    default: {
      data: {
        products: [
          {
            id: "yearly",
            slug: "yearly",
            displayName: "Yearly",
            priceString: "$59.99",
            period: "year",
          },
        ],
      },
    },
  },
  render: ({ props, actions }) => {
    const { selectedProductId } = useSelectedProduct();
    const isSelected = selectedProductId === props.product.id;
    return (
      <Pressable onPress={() => actions.onSelect({ product: props.product.id })}>
        <View
          style={[
            { paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: "rgba(255, 255, 255, 0.15)" },
            isSelected && { borderColor: props.accentColor },
          ]}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: "rgba(255, 255, 255, 1)" }}>
            {props.product.displayName}
          </Text>
          <Text style={{ fontSize: 14, color: "rgba(200, 200, 210, 1)" }}>
            {props.product.priceString}
          </Text>
          <Slot />
        </View>
      </Pressable>
    );
  },
});
\`\`\`

### \`defineComponent\` shape

\`defineComponent({ title?, description?, props?, actions?, previews?, panel?, render })\`.
There is **NO \`id\`** — a component is identified by its FILE PATH
(\`components/<name>.tsx\`), which is the path a \`component\` node references.

- \`render: ({ props, actions }) => ReactNode\` — the template. \`props\` has
  defaults filled and \`.optional()\` props typed \`T | undefined\`; \`actions\` are
  typed callbacks.
- The file MUST default-export the \`defineComponent({ … })\` definition itself —
  \`export default defineComponent({ … })\`. Do NOT export a \`.component\` property or
  any other shape — only the \`defineComponent(...)\` result is valid.

### Prop builders (\`p\`)

Chainable, immutable: \`.label(str)\`, \`.default(value)\`, \`.optional()\`, and
\`.editor("color")\` (string props only).

- \`p.string()\` — string. \`p.number()\`, \`p.boolean()\`.
- \`p.select([...] as const)\` — a string constrained to the options.
- \`p.image()\` — an image URL/asset reference (string).
- \`p.ref("product")\` — a product reference; the template receives a
  \`PaywallProduct\`.
- \`p.component()\` — a nested element the editor fills; the template receives a
  \`ReactNode\`.
- \`p.array(item)\` — a homogeneous list; \`item\` must be a non-array builder.

### Action builders (\`a\`)

- \`a.action()\` — a payload-free action; template callback is \`() => void\`.
- \`a.action({ field: a.string() })\` — a typed payload; template callback is
  \`(payload) => void\`. Payload fields are scalars: \`a.string()\`, \`a.number()\`,
  \`a.boolean()\`.

### Primitives (\`@voidhash/paywalls\`)

\`View\`, \`Text\`, \`Pressable\`, \`ScrollView\`, \`Image\`, \`Slot\`. \`style\` accepts a
\`StyleProp\` — a single object OR an array with falsy entries ignored
(\`style={[base, cond && override]}\`) — using the SAME RN style vocabulary as the
document (plus text-only \`textTransform\`/\`textDecorationLine\`/\`fontStyle\`/\`fontFamily\`).

- \`<Pressable onPress={…}>\` — the tap surface. Pass a declared action directly
  (\`onPress={actions.onSelect}\`) or wrap it (\`onPress={() => actions.onSelect({…})}\`).
- \`<Image source={"…" | { uri }} resizeMode="cover" />\`.
- \`<Slot />\` renders children the document passed into the component instance;
  \`<Slot fallback={…} />\` renders fallback when none were passed.

### Runtime hooks (\`@voidhash/paywalls\`)

- \`usePaywallProducts(): readonly PaywallProduct[]\` — the available products
  (map over these to render a list).
- \`useSelectedProduct(): { selectedProduct, selectedProductId, selectProduct }\`.
- \`usePaywallVariables(): Record<string, string | number | boolean>\`.
- \`usePaywallActions(): { purchase, restore, close, openUrl, track, selectProduct }\`.
- \`usePaywallStatus(): { status, productId?, error? }\` —
  \`idle\`/\`purchasing\`/\`purchased\`/\`restoring\`/\`restored\`/\`failed\`.
- \`usePaywallConfig(): PaywallRuntimeConfig\` (products, variables, locale,
  platform).

\`PaywallProduct\`:
\`{ id, slug, displayName, description?, price?, priceString, currencyCode?, period?, trialPeriod? }\`
where \`period\` is \`"month" | "year" | "week" | "lifetime"\`.

### Renaming and deleting components

- \`rename_component(fromPath, toPath)\` — moves the component. Instances
  referencing the old path are RE-POINTED automatically (rename cascade), so the
  \`component\` nodes keep working.
- \`delete_component(path)\` — removes the component. Existing instances degrade to
  placeholders (they are NOT cascade-deleted), so replace or remove those
  \`component\` nodes afterward.

## Tool vocabulary

All tools operate on the currently open paywall, except \`read_paywall\`.

- \`get_document(nodeId?, depth?)\` — read the open paywall's document as cleaned
  JSON (subtree + depth for economy).
- \`get_components()\` — list every placeable component (catalog + local +
  builtin) with paths/slugs, props, actions, and preview states.
- \`read_component(path)\` — read a LOCAL code component's TSX source.
- \`read_paywall(slug)\` — read ANOTHER paywall's document JSON for reference
  (read-only).
- \`edit_document(edits)\` — apply an atomic batch of document ops (returns minted
  ids or per-op errors).
- \`write_component(path, source)\` — create-or-replace a code component (compiles;
  returns diagnostics on failure).
- \`rename_component(fromPath, toPath)\` — move a component (instances re-pointed).
- \`delete_component(path)\` — delete a component (instances degrade to
  placeholders).

Read (\`get_document\`/\`get_components\`) before you write, use the minted ids the
edits return, and trust the field/value errors the validator gives you.
`);
