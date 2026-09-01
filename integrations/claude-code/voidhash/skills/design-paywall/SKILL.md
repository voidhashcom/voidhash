---
name: design-paywall
description: Design, edit, preview, visually review, finish, or revert a Voidhash paywall with the shared workspace tools.
---

# Paywall Authoring Reference

This is the domain reference for building a paywall as a mimic document
with `edit_paywall`, plus code components for anything that needs real code.
Read the document model and containment rules first — the style reference below is
generated from the live schema, so it is always exact.

## Document model

A paywall is a MIMIC DOCUMENT: a tree of nodes. You author it with `edit_paywall`
ops (`insert`, `update`, `move`, `remove`, `replaceChildren`), addressing nodes
by their engine-minted id. The node kinds you build with:

- `screen` — the paywall's root visual frame (the top-level node under the
  document). Holds the whole layout; has a background, safe-area flags, and a
  fixed default size (375×812).
- `view` — a flex container / row / column. The workhorse for layout, grouping,
  cards, buttons (a `view` with a click interaction is a tappable surface —
  there is no separate button/pressable node).
- `scrollView` — a `view` that SCROLLS. Same style/children as a `view`; use it
  for content taller than the screen. `horizontal: true` scrolls sideways and lays
  its children out in a row (forces row flow, like RN); `showsScrollIndicator: false`
  hides the scrollbar.
- `text` — a text leaf. Its `text` data field is the literal string it renders.
- `shape` — a vector container that holds `path` nodes (for icons / custom
  vector art).
- `path` — a single vector path inside a `shape`.
- `component` — an INSTANCE of a catalog component, a local code component, or a
  first-party BUILTIN that ships with the renderer. Insert one to place a reusable
  widget; bind its props/actions (discover them with `get_components`). Insert a
  builtin with `componentSource: "builtin"` and its `componentSlug` from
  `get_components` — builtins are UNPINNED (no version/hash) and take props like
  any component.

Node ids are ADDRESSES: every node has a stable id. `get_paywall` returns the
tree with ids; the user's selection is a set of ids; inserts RETURN their minted
ids. You never write an id yourself.

### Containment (which node may hold which)

An `insert`/`move` into a parent that cannot contain the node type is rejected.
The legal parent → child rules (generated from the schema):

- `screen` may contain: `view`, `scrollView`, `text`, `shape`, `component`
- `view` may contain: `view`, `scrollView`, `text`, `shape`, `component`
- `scrollView` may contain: `view`, `scrollView`, `text`, `shape`, `component`
- `text` is a leaf (no child nodes).
- `shape` may contain: `path`
- `path` is a leaf (no child nodes).
- `component` may contain: `view`, `scrollView`, `text`, `shape`, `component`

## Style reference (generated from the schema)

Style is a per-node `style` object of RN-named fields (NO shorthands: write
`paddingTop`/`paddingRight`/… never `padding`; `borderTopLeftRadius`/… never
`borderRadius`). Colors are `rgba(r, g, b, a)` strings. Each node type accepts a
different subset; a field not listed for a node type is rejected on it.

**Group flags are AUTO-MANAGED in a node's base `style`.** Setting ANY background /
border / shadow (or, on `path`, fill / stroke) field there automatically turns
that group's `<group>Enabled` flag on — just set `backgroundColor` and the
background renders. Inside `states[].overrides.style`, explicitly include the
matching `*Enabled: true` flag when the base style has not already enabled that
group. The flags also support non-destructive hiding: explicitly set one to
`false` (e.g. `{ backgroundEnabled: false }`) to hide a group while keeping its
fields for later.

Set a style field via `update` with merge semantics: `set: { style: { paddingTop: 8 } }`
changes ONLY `paddingTop` and leaves every other style field untouched. To insert
a node with styles, put the `style` object on the inserted node.

### `screen` style fields

- `x`: number (default 0)
- `y`: number (default 0)
- `width`: number (default 375)
- `height`: number (default 812)
- `minWidth`: number (no default)
- `maxWidth`: number (no default)
- `minHeight`: number (no default)
- `maxHeight`: number (no default)
- `paddingTop`: number (default 0)
- `paddingRight`: number (default 0)
- `paddingBottom`: number (default 0)
- `paddingLeft`: number (default 0)
- `marginTop`: number (default 0)
- `marginRight`: number (default 0)
- `marginBottom`: number (default 0)
- `marginLeft`: number (default 0)
- `gap`: number (default 0)
- `justifyContent`: "flex-start" | "center" | "flex-end" | "space-between" | "space-around" | "space-evenly" (default "flex-start")
- `alignItems`: "flex-start" | "center" | "flex-end" | "stretch" | "baseline" (default "stretch")
- `flexDirection`: "row" | "column" (default "column")
- `backgroundColor`: color (rgba) (default "rgba(255, 255, 255, 1)")
- `backgroundEnabled`: boolean (default true) — AUTO-MANAGED: set to true automatically when you set any background field; write `false` explicitly to hide the background without deleting its fields.
- `backgroundType`: "solid" | "gradient" | "image" (default "solid")
- `backgroundGradient`: object (default {"kind":"linear","startX":0.5,"startY":0,"endX":0.5,"endY":1,"stops":[{"color":"rgba(255, 255, 255, 1)","position":0},{"color":"rgba(255, 255, 255, 0)","position":1}]})
- `backgroundImage`: object (default {"url":"","resizeMode":"cover"})
- `borderTopWidth`: number (default 0)
- `borderRightWidth`: number (default 0)
- `borderBottomWidth`: number (default 0)
- `borderLeftWidth`: number (default 0)
- `borderColor`: color (rgba) (default "rgba(0, 0, 0, 1)")
- `borderStyle`: "solid" | "dashed" | "dotted" (default "solid")
- `borderEnabled`: boolean (default false) — AUTO-MANAGED: set to true automatically when you set any border field; write `false` explicitly to hide the border without deleting its fields.
- `opacity`: number (default 1)
- `overflow`: "visible" | "hidden" | "scroll" (default "visible")
- `zIndex`: number (default 0)
- `display`: "flex" | "none" (default "flex")
- `shadowEnabled`: boolean (default false) — AUTO-MANAGED: set to true automatically when you set any shadow field; write `false` explicitly to hide the shadow without deleting its fields.
- `shadowColor`: color (rgba) (default "rgba(0, 0, 0, 1)")
- `shadowOffsetX`: number (default 0)
- `shadowOffsetY`: number (default 0)
- `shadowRadius`: number (default 0)
- `shadowOpacity`: number (default 1)
- `safeAreaTop`: boolean (default false)
- `safeAreaBottom`: boolean (default false)
- `flex`: number (no default)
- `flexGrow`: number (default 0)
- `flexShrink`: number (default 1)
- `flexBasis`: number (default "auto")
- `alignSelf`: "auto" | "flex-start" | "center" | "flex-end" | "stretch" | "baseline" (default "auto")

### `view` style fields

- `paddingTop`: number (default 0)
- `paddingRight`: number (default 0)
- `paddingBottom`: number (default 0)
- `paddingLeft`: number (default 0)
- `marginTop`: number (default 0)
- `marginRight`: number (default 0)
- `marginBottom`: number (default 0)
- `marginLeft`: number (default 0)
- `gap`: number (default 0)
- `justifyContent`: "flex-start" | "center" | "flex-end" | "space-between" | "space-around" | "space-evenly" (default "flex-start")
- `alignItems`: "flex-start" | "center" | "flex-end" | "stretch" | "baseline" (default "stretch")
- `flexDirection`: "row" | "column" (default "column")
- `width`: number (default "auto")
- `height`: number (default "auto")
- `minWidth`: number (no default)
- `maxWidth`: number (no default)
- `minHeight`: number (no default)
- `maxHeight`: number (no default)
- `backgroundColor`: color (rgba) (default "rgba(255, 255, 255, 1)")
- `backgroundEnabled`: boolean (default false) — AUTO-MANAGED: set to true automatically when you set any background field; write `false` explicitly to hide the background without deleting its fields.
- `backgroundType`: "solid" | "gradient" | "image" (default "solid")
- `backgroundGradient`: object (default {"kind":"linear","startX":0.5,"startY":0,"endX":0.5,"endY":1,"stops":[{"color":"rgba(255, 255, 255, 1)","position":0},{"color":"rgba(255, 255, 255, 0)","position":1}]})
- `backgroundImage`: object (default {"url":"","resizeMode":"cover"})
- `borderTopWidth`: number (default 0)
- `borderRightWidth`: number (default 0)
- `borderBottomWidth`: number (default 0)
- `borderLeftWidth`: number (default 0)
- `borderColor`: color (rgba) (default "rgba(0, 0, 0, 1)")
- `borderStyle`: "solid" | "dashed" | "dotted" (default "solid")
- `borderEnabled`: boolean (default false) — AUTO-MANAGED: set to true automatically when you set any border field; write `false` explicitly to hide the border without deleting its fields.
- `borderTopLeftRadius`: number (default 0)
- `borderTopRightRadius`: number (default 0)
- `borderBottomRightRadius`: number (default 0)
- `borderBottomLeftRadius`: number (default 0)
- `opacity`: number (default 1)
- `overflow`: "visible" | "hidden" | "scroll" (default "visible")
- `zIndex`: number (default 0)
- `position`: "absolute" | "relative" (default "relative")
- `left`: number (default "auto")
- `top`: number (default "auto")
- `right`: number (default "auto")
- `bottom`: number (default "auto")
- `display`: "flex" | "none" (default "flex")
- `shadowEnabled`: boolean (default false) — AUTO-MANAGED: set to true automatically when you set any shadow field; write `false` explicitly to hide the shadow without deleting its fields.
- `shadowColor`: color (rgba) (default "rgba(0, 0, 0, 1)")
- `shadowOffsetX`: number (default 0)
- `shadowOffsetY`: number (default 0)
- `shadowRadius`: number (default 0)
- `shadowOpacity`: number (default 1)
- `safeAreaTop`: boolean (default false)
- `safeAreaBottom`: boolean (default false)
- `flex`: number (no default)
- `flexGrow`: number (default 0)
- `flexShrink`: number (default 1)
- `flexBasis`: number (default "auto")
- `alignSelf`: "auto" | "flex-start" | "center" | "flex-end" | "stretch" | "baseline" (default "auto")

### `text` style fields

- `marginTop`: number (default 0)
- `marginRight`: number (default 0)
- `marginBottom`: number (default 0)
- `marginLeft`: number (default 0)
- `minWidth`: number (no default)
- `maxWidth`: number (no default)
- `minHeight`: number (no default)
- `maxHeight`: number (no default)
- `fontSize`: number (default 16)
- `fontWeight`: "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900" (default "400")
- `color`: color (rgba) (default "rgba(0, 0, 0, 1)")
- `textAlign`: "left" | "center" | "right" | "justify" (default "left")
- `lineHeight`: number (default 1.5)
- `letterSpacing`: number (default 0)
- `borderTopWidth`: number (default 0)
- `borderRightWidth`: number (default 0)
- `borderBottomWidth`: number (default 0)
- `borderLeftWidth`: number (default 0)
- `borderColor`: color (rgba) (default "rgba(0, 0, 0, 1)")
- `borderStyle`: "solid" | "dashed" | "dotted" (default "solid")
- `borderEnabled`: boolean (default false) — AUTO-MANAGED: set to true automatically when you set any border field; write `false` explicitly to hide the border without deleting its fields.
- `opacity`: number (default 1)
- `overflow`: "visible" | "hidden" | "scroll" (default "visible")
- `zIndex`: number (default 0)
- `position`: "absolute" | "relative" (default "relative")
- `left`: number (default "auto")
- `top`: number (default "auto")
- `right`: number (default "auto")
- `bottom`: number (default "auto")
- `display`: "flex" | "none" (default "flex")
- `shadowEnabled`: boolean (default false) — AUTO-MANAGED: set to true automatically when you set any shadow field; write `false` explicitly to hide the shadow without deleting its fields.
- `shadowColor`: color (rgba) (default "rgba(0, 0, 0, 1)")
- `shadowOffsetX`: number (default 0)
- `shadowOffsetY`: number (default 0)
- `shadowRadius`: number (default 0)
- `shadowOpacity`: number (default 1)
- `flex`: number (no default)
- `flexGrow`: number (default 0)
- `flexShrink`: number (default 1)
- `flexBasis`: number (default "auto")
- `alignSelf`: "auto" | "flex-start" | "center" | "flex-end" | "stretch" | "baseline" (default "auto")

### `shape` style fields

- `width`: number (default "auto")
- `height`: number (default "auto")
- `minWidth`: number (no default)
- `maxWidth`: number (no default)
- `minHeight`: number (no default)
- `maxHeight`: number (no default)
- `marginTop`: number (default 0)
- `marginRight`: number (default 0)
- `marginBottom`: number (default 0)
- `marginLeft`: number (default 0)
- `opacity`: number (default 1)
- `display`: "flex" | "none" (default "flex")
- `flex`: number (no default)
- `flexGrow`: number (default 0)
- `flexShrink`: number (default 1)
- `flexBasis`: number (default "auto")
- `alignSelf`: "auto" | "flex-start" | "center" | "flex-end" | "stretch" | "baseline" (default "auto")
- `preserveAspectRatio`: "none" | "xMidYMid meet" | "xMidYMid slice" (default "xMidYMid meet")

### `path` style fields

- `fillColor`: color (rgba) (default "rgba(255, 255, 255, 1)")
- `fillEnabled`: boolean (default false) — AUTO-MANAGED: set to true automatically when you set any fill field; write `false` explicitly to hide the fill without deleting its fields.
- `fillRule`: "nonzero" | "evenodd" (default "nonzero")
- `fillOpacity`: number (default 1)
- `strokeColor`: color (rgba) (default "rgba(0, 0, 0, 1)")
- `strokeEnabled`: boolean (default false) — AUTO-MANAGED: set to true automatically when you set any stroke field; write `false` explicitly to hide the stroke without deleting its fields.
- `strokeWidth`: number (default 0)
- `strokeOpacity`: number (default 1)
- `strokeLinecap`: "butt" | "round" | "square" (default "butt")
- `strokeLinejoin`: "miter" | "round" | "bevel" (default "miter")
- `opacity`: number (default 1)
- `display`: "flex" | "none" (default "flex")

### Flex layout (defaults match CSS)

Layout is flexbox, exactly like CSS / React Native:

- Views **hug their content** by default: `width` and `height` default to
  `"auto"`. Do NOT set a numeric `width`/`height` just to "make it fit" — omit
  them and let flex size the node. Set a number only for a genuinely fixed size.
- A container **stretches its children on the CROSS axis** by default
  (`alignItems` defaults to `"stretch"`). So a child of a `column` fills the
  container's width, and a child of a `row` fills its height, automatically —
  you do not need `alignSelf` or a width/height for that.
- To make a child **fill the MAIN axis** (grow to share leftover space), give it
  `flex: 1` (e.g. a spacer, or two side-by-side cards that split a row).
- Cross-axis fill is automatic UNLESS the child opts out — either a numeric size
  on that axis (a fixed size defeats stretch) or a non-`stretch` `alignSelf`
  (`"flex-start"`/`"center"`/`"flex-end"`). Set `alignSelf` only to deviate from
  the container's alignment.
- Prefer omitting `width`/`height` and reaching for `flexDirection`, `gap`,
  `justifyContent` (main axis), `alignItems` (cross axis), and `flex` to compose
  layout — the same tools you would use in CSS.

### Structured style values (gradient / image backgrounds)

`backgroundGradient` and `backgroundImage` are objects. Set
`backgroundType: "gradient"` (or `"image"`) for the chosen fill to render
(`backgroundEnabled` is turned on automatically for you).

```json
// backgroundGradient
{ "kind": "linear", "startX": 0.5, "startY": 0, "endX": 0.5, "endY": 1,
  "stops": [ { "color": "rgba(255,255,255,1)", "position": 0 },
             { "color": "rgba(255,255,255,0)", "position": 1 } ] }
// backgroundImage
{ "url": "https://…", "resizeMode": "cover" }  // cover | contain | stretch | center
```

## Tool usage

- **Open your edit session.** Discover the target with `list_paywalls`, then call
  `begin_paywall_edit({ paywallId })`. Pass only the returned `editSessionId` to every
  scoped call. Every participant gets an independent Mimic connection, so multiple users
  and agents may edit the same paywall concurrently. Finish yours after visual QA, or
  revert it; never abandon an active session.
- **`get_paywall` first.** Learn the current tree and ids before editing. Pass
  `nodeId` to root at a subtree and `depth` to cap the tree (deeper nodes return
  as `{ id, type, name?, childCount }` stubs you expand with a follow-up
  `get_paywall({ editSessionId, nodeId })`). Cheaper than pulling the whole document every
  turn.
- **`edit_paywall` applies an ATOMIC batch.** Every op lands or none does. On
  success you get the minted ids for `insert`/`replaceChildren` ops (keyed by op
  index, parents-before-children) so you can address new nodes next. On failure
  you get per-op errors naming the node, the allowed fields (with a did-you-mean),
  and the allowed values — trust them and correct the batch. On a write conflict
  the batch is re-applied against the latest LIVE tree, so concurrent designer
  edits MERGE rather than clobber — a follow-up `get_paywall` may show a tree
  shifted by another editor's changes.
- **Merge semantics on `update`.** `set.style` merges per style field; other
  objects merge per-field; arrays and scalars REPLACE wholesale. Send only the
  fields you want to change.
- **Ids are minted.** Never supply an id on an inserted node. Target existing
  nodes with ids from `get_paywall`, the selection, or a prior insert's returned
  ids.
- **Selection ids are directly addressable.** When the context block lists
  selected node ids, use them straight in ops (no need to re-locate them).
- **`duplicate_subtree` preserves visual systems.** Prefer it over rebuilding a
  repeated benefit, product option, card, or control from scratch. Fresh ids are
  returned, so immediately tailor the clone's content/state with focused updates.
- **`get_paywall_preview` is the visual checkpoint.** Capture the screen after
  each meaningful visual section and after every correction pass. Inspect the
  pixels; do not infer visual quality from the document tree alone.
- **`finish_paywall_edit` is the completion gate.** It accepts only the exact signature
  of the latest screenshot while the document is unchanged and
  `unresolvedIssues` is empty. Any post-review edit requires a new screenshot.

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
`finish_paywall_edit` with the final screenshot's document signature.

### Op cheatsheet

- `insert` — add a subtree under `parentId` at `index` (append if omitted).
- `update` — partial data change on `nodeId` (`set`, merge semantics above).
- `move` — reparent `nodeId` under `parentId` at `index` (cycles/illegal
  containment rejected).
- `remove` — delete `nodeId` and its subtree.
- `replaceChildren` — swap `nodeId`'s whole child list for a new ordered one.

## Worked examples

### (a) Insert a screen's content in one batch

Add a header row and a title inside the screen `scr_1` (ids returned are used
implicitly by nesting the `children` inline):

```json
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
```

### (b) Restyle the selected node

The user has `view_9` selected and asks for a rounded indigo card. Change only
the fields you mean to (style merges per field):

```json
{ "edits": [
  { "op": "update", "nodeId": "view_9", "set": { "style": {
      "backgroundColor": "rgba(99,102,241,1)",
      "borderTopLeftRadius": 12, "borderTopRightRadius": 12,
      "borderBottomRightRadius": 12, "borderBottomLeftRadius": 12,
      "paddingTop": 16, "paddingRight": 16, "paddingBottom": 16, "paddingLeft": 16 } } }
] }
```

### (c) Insert a component instance and bind it

First `get_components` to read the component's path/slug, props, and actions.
Then insert a `component` node. A `component` node's identity fields select which
component to place; `props` binds its inputs and interactions/actions wire its
outputs. Read the exact prop/action names from `get_components` (they differ per
component) and follow the shapes the tool reports — do not assume field names.
Bind a purchase to the component's declared action via the same interaction model
as (d): a `purchase-product` action on the component's action slot.

### (d) Variables, states, and actions (dynamic behavior without code)

These three first-class document fields form a small no-code state machine:

1. **Variables hold runtime state.** Put `localVariables` on a common ancestor so
   the node and its descendants can read them. Supported values are
   `{ key: "string", value }`, `{ key: "number", value }`,
   `{ key: "boolean", value }`, and
   `{ key: "product", value: { productId? } }`. Variables may live on
   `screen`, `view`, `scrollView`, `text`, `shape`, or `path`; lookup is
   lexical (own node, then nearest ancestor). Declare shared state on the nearest
   common ancestor and reference its stable `id`, never its display `name`.
2. **Actions change state or call the host.** A `view` or `scrollView` has an
   `interactions` array of `{ id, trigger: { type: "click" }, action }`. The
   action is `none`, `close-paywall`, `set-variable`, or `purchase-product`.
   Values/products can be literals or variable references. A `component` exposes
   named outputs through `actionBindings`; bind those names (from
   `get_components`) to the same actions, optionally reading a field from the
   component's emitted payload with `{ type: "action-payload", ... }`.
3. **States react to variables.** Stateful nodes have a `states` array. Each state
   has `{ id, name, condition, overrides }`. A condition is DNF:
   `{ type: "or", value: [ { type: "and", value: [predicates...] } ] }` — any
   OR branch may match, while every predicate in an AND branch must match.
   Predicates are `equals`, `not-equals`, `greater-than`,
   `greater-than-or-equal`, `less-than`, or `less-than-or-equal`; each operand
   is a typed literal or `{ type: "variable-reference", value: { id } }`.
   Matching states merge `overrides.style` over the base style immediately after
   a variable changes. Later matching states win conflicting fields. On `view`
   and `scrollView`, a state may also replace an interaction's action through
   `overrides.actions`; its `interactionId` must be the interaction array-entry
   id returned by `get_paywall`. State style overrides do not auto-enable gated
   groups, so include `backgroundEnabled`, `borderEnabled`, `shadowEnabled`,
   `fillEnabled`, or `strokeEnabled` when an override first turns on that group.

This is enough for product selection, toggles, conditional emphasis/visibility,
multi-step sections, close buttons, and a CTA that purchases the selected product
without TSX. Build the cycle as **declare variable → click action updates variable
→ matching state changes appearance/behavior → CTA consumes variable**.

Example: declare the selected product on the screen, make a yearly option select
it and show its selected style, then have the CTA purchase the current selection.
Repeat the option action/state for each other product id:

```json
{ "edits": [
  { "op": "update", "nodeId": "scr_1", "set": { "localVariables": [
    { "id": "selected_product", "name": "Selected product",
      "value": { "key": "product", "value": { "productId": "yearly" } } }
  ] } },
  { "op": "update", "nodeId": "view_yearly", "set": {
    "interactions": [
      { "id": "select_yearly", "trigger": { "type": "click" },
        "action": { "type": "set-variable", "payload": {
          "variableId": "selected_product",
          "newValue": { "type": "literal", "value": {
            "key": "product", "value": { "productId": "yearly" }
          } }
        } }
      }
    ],
    "states": [
      { "id": "yearly_selected", "name": "Selected", "condition": {
          "type": "or", "value": [
            { "type": "and", "value": [
              { "type": "equals", "value": {
                "left": { "type": "variable-reference", "value": { "id": "selected_product" } },
                "right": { "type": "literal", "value": {
                  "key": "product", "value": { "productId": "yearly" }
                } }
              } }
            ] }
          ]
        }, "overrides": { "style": {
          "backgroundEnabled": true,
          "backgroundColor": "rgba(99,102,241,0.16)",
          "borderEnabled": true,
          "borderColor": "rgba(99,102,241,1)",
          "borderTopWidth": 2, "borderRightWidth": 2,
          "borderBottomWidth": 2, "borderLeftWidth": 2
        } }
      }
    ]
  } },
  { "op": "update", "nodeId": "view_cta", "set": { "interactions": [
    { "id": "purchase_selected", "trigger": { "type": "click" },
      "action": { "type": "purchase-product", "payload": {
        "type": "variable-reference", "variableId": "selected_product"
      } }
    }
  ] } }
] }
```

Arrays replace wholesale on `update`, so preserve every existing variable,
interaction, state, prop binding, or action binding you still need. The `id`
fields inside these arrays are stable logical ids for sub-records, not node ids.

## Doctrine: build with the document, reach for code only when you must

**The document (`edit_paywall`) is ALWAYS the primary way to build a paywall.**
Static layout, styling, literal text, local variables, click/component actions,
and variable-driven style/visibility states all belong in the document. Write a
code component ONLY when the document genuinely cannot express what you need:

- **Mapping/looping** — one row per product, or any list built by iterating over
  runtime data (`usePaywallProducts()`).
- **Structural branching** — different children/content that cannot be expressed
  by a variable-driven style state (simple conditional visibility via `display`
  belongs in document states).
- **Transient pressed / hover / focus pseudo-states** — document states are driven
  by variables, not pointer/gesture lifecycle.
- **Animation.**
- **Custom formatting logic** — deriving "$5/mo billed yearly", percent savings,
  trial copy.
- **Runtime-data-bound text** — a `text` node renders a LITERAL string; it cannot
  interpolate a product price or a variable. Data-driven text needs a component.

### Decision checklist

1. Static layout + literal text? → **document** (`screen`/`view`/`text` nodes).
2. Selection, toggle, conditional styling/visibility, close, or purchase flow? →
   **document variables + states + actions.**
3. Text needs runtime data (price, count, formatting)? → code component for that
   text only.
4. A list produced by iterating products/data? → code component (map).
5. Structural branching not expressible with state style overrides? → code component.
6. Pressed/hover/animated visuals? → code component.
7. Otherwise → **document.** Prefer building with nodes.

When a code component IS needed, keep it **as small as possible** — one focused
interactive widget — then place it as a `component` node in the document.

## Code-component authoring (`components/<name>.tsx`)

A code component is a normal React component defined with `defineComponent` from
`@voidhash/paywalls`. Its identity is its path; a `component` node references it by
that path. Primitives, hooks, and full `StyleProp` arrays are all available here
(this is the escape hatch — real JS is allowed). Author it with `write_component`;
on success it compiles and becomes placeable, on failure you get compile
diagnostics to fix (the compile loop is internal to `write_component`).

```tsx
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
```

### `defineComponent` shape

`defineComponent({ title?, description?, props?, actions?, previews?, panel?, render })`.
There is **NO `id`** — a component is identified by its FILE PATH
(`components/<name>.tsx`), which is the path a `component` node references.

- `render: ({ props, actions }) => ReactNode` — the template. `props` has
  defaults filled and `.optional()` props typed `T | typeof Schema.Undefined.Type`; `actions` are
  typed callbacks.
- Preview-state `data` accepts `products`, `variables`, `platform`,
  `safeAreaInsets`, and `dimensions` for deterministic runtime-hook branches.
- The file MUST default-export the `defineComponent({ … })` definition itself —
  `export default defineComponent({ … })`. Do NOT export a `.component` property or
  any other shape — only the `defineComponent(...)` result is valid.

### Prop builders (`p`)

Chainable, immutable: `.label(str)`, `.default(value)`, `.optional()`, and
`.editor("color")` (string props only).

- `p.string()` — string. `p.number()`, `p.boolean()`.
- `p.select([...] as const)` — a string constrained to the options.
- `p.image()` — an image URL/asset reference (string).
- `p.ref("product")` — a product reference; the template receives a
  `PaywallProduct`.
- `p.component()` — a nested element the editor fills; the template receives a
  `ReactNode`.
- `p.array(item)` — a homogeneous list; `item` must be a non-array builder.

### Action builders (`a`)

- `a.action()` — a payload-free action; template callback is `() => void`.
- `a.action({ field: a.string() })` — a typed payload; template callback is
  `(payload) => void`. Payload fields are scalars: `a.string()`, `a.number()`,
  `a.boolean()`.

### Primitives (`@voidhash/paywalls`)

`View`, `Text`, `Pressable`, `ScrollView`, `Image`, `Slot`. `style` accepts a
`StyleProp` — a single object OR an array with falsy entries ignored
(`style={[base, cond && override]}`) — using the SAME RN style vocabulary as the
document (plus text-only `textTransform`/`textDecorationLine`/`fontStyle`/`fontFamily`).

- `<Pressable onPress={…}>` — the tap surface. Pass a declared action directly
  (`onPress={actions.onSelect}`) or wrap it (`onPress={() => actions.onSelect({…})}`).
- `<Image source={"…" | { uri }} resizeMode="cover" />`.
- `<Slot />` renders children the document passed into the component instance;
  `<Slot fallback={…} />` renders fallback when none were passed.

### Runtime hooks (`@voidhash/paywalls`)

- `usePaywallProducts(): readonly PaywallProduct[]` — the available products
  (map over these to render a list).
- `useSelectedProduct(): { selectedProduct, selectedProductId, selectProduct }`.
- `usePaywallVariables(): Record<string, string | number | boolean>`.
- `usePlatform(): "ios" | "android" | "web"`.
- `useSafeAreaInsets(): { top, right, bottom, left }` in logical pixels.
- `useDimensions("screen" | "window"): { width, height, x, y }` in logical pixels;
  `x` and `y` are screen-space origins.
- `usePaywallActions(): { purchase, restore, close, openUrl, track, selectProduct }`.
- `usePaywallStatus(): { status, productId?, error? }` —
  `idle`/`purchasing`/`purchased`/`restoring`/`restored`/`failed`.
- `usePaywallConfig(): PaywallRuntimeConfig` (products, variables, locale,
  platform, safe-area insets, and dimensions).

Explicit runtime or preview environment values take precedence and late configuration updates
consumers. Browser measurements react to resize, orientation, and visual-viewport events.
Missing platform defaults to `web`; unavailable safe-area and SSR measurements use zero.

`PaywallProduct`:
`{ id, slug, displayName, description?, price?, priceString, currencyCode?, period?, trialPeriod? }`
where `period` is `"month" | "year" | "week" | "lifetime"`.

### Renaming and deleting components

- `rename_component(fromPath, toPath)` — moves the component. Instances
  referencing the old path are RE-POINTED automatically (rename cascade), so the
  `component` nodes keep working.
- `delete_component(path)` — removes the component. Existing instances degrade to
  placeholders (they are NOT cascade-deleted), so replace or remove those
  `component` nodes afterward.

## Tool vocabulary

- `list_paywalls()` — discover stable paywall ids (plus display slugs) in the project.
- `begin_paywall_edit({ paywallId })` — capture the revert baseline and return a
  `editSessionId`.
- `get_paywall({ editSessionId, nodeId?, depth? })` — read cleaned document JSON (subtree
  + depth for economy).
- `get_components({ editSessionId })` — list every placeable catalog, local, and builtin
  component with its authoring contract.
- `read_component({ editSessionId, path })` — read a local code component's TSX source.
- `edit_paywall({ editSessionId, edits })` — apply an atomic batch of document
  ops (returns minted ids or per-op errors).
- `duplicate_subtree({ editSessionId, nodeId, parentId, index? })` — clone a
  visual subtree with fresh ids.
- `write_component({ editSessionId, path, source })` — create or replace a
  compiled code component.
- `rename_component({ editSessionId, fromPath, toPath })` — move a component
  and re-point its instances.
- `delete_component({ editSessionId, path })` — delete a component; existing
  instances degrade to placeholders.
- `get_paywall_preview({ editSessionId })` — render the version-bound PNG
  used for visual QA.
- `finish_paywall_edit({ editSessionId, reviewedDocumentSignature, verdict,
  unresolvedIssues: [] })` — accept a visually verified edit.
- `revert_paywall_edit({ editSessionId })` — restore the captured baseline when that can
  be done without overwriting interleaved participant work. A mutation-free session closes
  without changing the document.

Read (`get_paywall`/`get_components`) before you write, use the minted ids the
edits return, and trust the field/value errors the validator gives you.
