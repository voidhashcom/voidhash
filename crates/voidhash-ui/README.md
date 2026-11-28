# voidhash-ui

Write Voidhash paywall components in Rust.

A code component is a small WebAssembly module that renders part of a paywall:
a plan picker, a countdown banner, a mini-game that unlocks a discount. The
paywall runtime in the Voidhash SDKs loads the module and draws what it
returns natively on iOS, Android and the web, so the component looks the same
everywhere and costs the app no web view.

`voidhash-ui` gives you a builder API in the style of SwiftUI, React-like
state, purchases and other paywall actions, a canvas for per-frame drawing,
native particle effects, and a `#[component]` attribute that describes your
component's props to the paywall editor.

```rust
#![no_std]

use voidhash_ui::prelude::*;

/// Selectable plan list shown above the purchase button.
#[component(events(selected(product_id: string)), capabilities(commerce))]
pub fn PlanPicker(
    cx: Cx,
    plans: Vec<Product>,
    #[prop(default = "#7c3aed")] accent: Color,
) -> View {
    let selected = cx.state(|| plans.first().map(|plan| plan.id.clone()));
    let current = selected.get();

    vstack()
        .spacing(12)
        .children(plans.iter().map(|plan| {
            let active = current.as_ref() == Some(&plan.id);
            let id = plan.id.clone();
            hstack()
                .key(&plan.id)
                .padding(16)
                .corner_radius(14)
                .background(if active { accent.opacity(0.15) } else { Color::SURFACE })
                .border(if active { 2 } else { 1 }, accent)
                .child(text(&plan.title).font(Font::HEADLINE).color(Color::PRIMARY))
                .child(spacer())
                .child(text(plan.price_per_period()).color(Color::SECONDARY))
                .on_tap(move |cx| {
                    selected.set(Some(id.clone()));
                    cx.emit("selected", object([("productId", Value::from(&id))]))
                })
        }))
        .child(button("Continue").prominent().background(accent).on_tap(move |cx| {
            if let Some(id) = &current {
                cx.purchase(id);
            }
        }))
}
```

Guides and complete examples, including a canvas game and a live countdown,
are in the [component documentation](https://voidhash.com/docs/components).

## Set up a component crate

You need stable Rust and the WebAssembly target:

```sh
rustup target add wasm32-unknown-unknown
```

A component is a library crate that builds a `cdylib`:

```toml
# Cargo.toml
[package]
name = "plan-picker"
version = "0.1.0"
edition = "2024"

[lib]
crate-type = ["cdylib"]

[dependencies]
voidhash-ui = "0.1"

# Modules are downloaded by apps: optimise for size.
[profile.release]
panic = "abort"
opt-level = "z"
lto = true
codegen-units = 1
strip = true
```

Components need far less than Rust's default 1 MiB stack. A smaller stack
keeps each instance's memory small:

```toml
# .cargo/config.toml
[target.wasm32-unknown-unknown]
rustflags = ["-C", "link-arg=-zstack-size=131072"]
```

Start `src/lib.rs` with `#![no_std]`. The prelude brings in `String`, `Vec`,
`vec!` and `Box`, so most components need nothing else. Build the module:

```sh
cargo build --release --target wasm32-unknown-unknown
```

The module is `target/wasm32-unknown-unknown/release/<crate_name>.wasm`. The
examples build to about 50 KB.

Each module contains exactly one component. Use one crate per component, or a
Cargo workspace with several component crates.

## Declare the component

`#[component]` goes on a function that takes the render context and the
component's props and returns a `View`:

```rust
#[component(
    id = "acme/plan-picker",         // default: "project/" and the name below
    name = "plan-picker",            // default: the function name in kebab-case
    version = "1.2.0",               // default: the crate's version
    title = "Plan picker",           // default: the function name as a sentence
    description = "…",               // default: the doc comment
    icon = "list",                   // an icon of the editor's set; default "component"
    category = "Plans",              // default: "Project"
    keywords("plans", "pricing"),
    events(selected(product_id: string), dismissed),
    capabilities(commerce),          // what it may ask the paywall to do, below
    traits(frame(resize = "width"), appearance, effects),
    states("default", "annual"),     // default: ("default")
    slots("default", "footer"),      // default: the slots the body renders
    size(width = "fill", height = "hug"),
    fallback = "placeholder",        // what apps that cannot run it show
)]
pub fn PlanPicker(cx: Cx, /* props */) -> View { … }
```

From this the attribute generates the component's definition, which the
paywall editor reads to show the component, its props, its events, its
editor sections and its preview states, and embeds it in the module.

`traits` opt the component into the editor's standard sections and canvas
behaviour: `frame` (how the canvas resizes it), `layout`, `appearance`,
`fill`, `border`, `outline`, `effects`, `typography`, `states`,
`interactions`, `variables` and `sharedElement`.

### Props

Every parameter after `cx` is a prop. Its name in the editor is the camelCase
form of the parameter name (`coin_color` becomes `coinColor`).

| Rust type                   | Prop type   | Notes                                                  |
| --------------------------- | ----------- | ------------------------------------------------------ |
| `String`                    | `string`    |                                                        |
| `f64`, `f32`, integers      | `number`    | Integers round towards zero and saturate.              |
| `bool`                      | `boolean`   |                                                        |
| `Color`                     | `color`     | `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`.             |
| `Fill`                      | `fill`      | A colour or a fill object, for an element's `fills`.   |
| `Image`, `Asset`            | `asset`     | An asset's URL; images unless `accepts(…)` says more.  |
| `Product`                   | `product`   | `id`, `title`, `price`, `period`, `trial`, `currency`. |
| `ProductId`                 | `product`   | Only the product's id.                                 |
| an enum deriving `PropEnum` | `enum`      | One option per variant.                                |
| `Option<T>`                 | as `T`      | `None` when the prop is unbound.                       |
| `Vec<T>`                    | list of `T` | Items of the wrong type are skipped.                   |

Set a default with `#[prop(default = …)]`. Defaults are literals: a string,
number, boolean, `None`, or an array of them (`[]`, `vec![…]`). The editor
shows the default, and the component receives it when the prop is missing or
has the wrong type. Without a default, a prop starts empty: `""`, `0`,
`false`, `#000000`, no product, no items, or an enum's first variant.

`#[prop(…)]` also tells the editor how to offer the prop:

```rust
pub fn Countdown(
    cx: Cx,
    #[prop(default = 900, min = 0, max = 3600, step = 1, unit = "s", group = "Timing")]
    duration: f64,
    #[prop(title = "Headline", localizable, max_length = 40)] title: String,
    #[prop(multiline)] details: String,
    #[prop(accepts(image))] badge: Asset,
    #[prop(visible_when(prop = "style", equals = "ring"))] thickness: f64,
    #[prop(max_items = 4)] features: Vec<String>,
    style: Style,
) -> View
```

Units are `px`, `%`, `s`, `deg` and `x`. `visible_when` takes `equals = …` or
`one_of = […]`. An enum prop lists its variants; each option's value is the
variant name in camelCase and its title the name as a sentence:

```rust
#[derive(Clone, Copy, PartialEq, PropEnum)]
pub enum Style {
    Bar,
    #[prop_enum(title = "Progress ring")]
    Ring,
}
```

```rust
pub fn Banner(
    cx: Cx,
    #[prop(default = "Launch offer")] title: String,
    #[prop(default = 900)] duration: f64,
    #[prop(name = "tint", default = "#f43f5e")] accent: Color,
    offer: Product,
) -> View
```

Product props arrive with localized, display-ready strings, such as `$59.99`
and `year`. `Product::price_per_period()` joins them (`$59.99 / year`).

### Events

Events are what your component fires and the paywall binds to behaviour,
such as a purchase, navigation or setting a variable. Declare them with their
payload fields and types (`string`, `number`, `boolean`, `color`, `image`,
`product`, or arrays such as `string[]`), then fire them with
`cx.emit("selected", payload)`.

### Capabilities

A component asks the paywall to act on its own only for what it declares:

| Capability   | Allows                         |
| ------------ | ------------------------------ |
| `commerce`   | `cx.purchase` and `cx.restore` |
| `links`      | `cx.open_url`                  |
| `analytics`  | `cx.track`                     |
| `navigation` | `cx.close`                     |
| `haptics`    | Reserved                       |

Requests the component did not declare are refused. Firing events needs no
capability: the paywall decides what they do.

### Preview states

`states(…)` lists the states the editor can preview. The chosen state reaches
the component as `cx.preview_state()`, so a component can start in the state
the designer wants to show (for example a game that is already won).

## An editor panel

A component can ship its own section of the paywall editor's right panel,
written in the same crate so it shares the component's prop types. The
editor draws the panel with its own controls, so it looks like the built-in
sections. The crate builds twice: by default into the component module
paywalls run, and with its `panel` feature into an editor-only panel module
that never reaches apps.

```toml
[features]
default = ["runtime"]
runtime = []
panel = ["voidhash-ui/panel"]
```

```rust
// src/lib.rs
mod panel;

#[derive(Clone, Copy, PartialEq, PropEnum)]
pub enum Layout { List, Compact }

#[component(traits(frame(resize = "width"), appearance))]
pub fn PlanPicker(
    cx: Cx,
    layout: Layout,
    #[prop(default = 12, min = 0, max = 32, unit = "px")] spacing: f64,
) -> View { … }

voidhash_ui::export_panels!(PLAN_PICKER => panel::SETTINGS);
```

```rust
// src/panel.rs
use voidhash_ui::panel::prelude::*;

use crate::Layout;

#[panel(for = "project/plan-picker", title = "Plan picker")]
pub fn settings(cx: &mut PanelCx) -> Panel {
    let compact = cx.prop("layout").read::<Layout>() == Layout::Compact;
    let mut section = section("Plan picker").child(
        field("Layout").child(
            toggle_group().options(enum_options::<Layout>()).bind(bind::prop("layout")),
        ),
    );
    if !compact {
        section = section.child(
            field("Spacing").child(number_field().icon("betweenHorizontalStart").bind(bind::prop("spacing"))),
        );
    }
    panel().child(section)
}
```

- `#[panel(for = …)]` names the component's own id. The panel edits the
  selected instances of the component: their props, and the style keys of
  the traits the component declares (`style("opacity")`). It cannot reach
  the rest of the document; instances get the editor's States,
  Interactions and Variables sections by declaring those traits.
- `export_panels!` lists the panels after the component's constant. The
  component's definition then declares `"panel": true`, and a panel naming
  another id fails to compile.
- Bind fields (`.bind(bind::prop("spacing"))`) to let the editor scrub,
  type and undo them itself; give other controls handlers that record
  intents (`cx.set_prop`, `cx.transaction`). `cx.ui_state` keeps tabs and
  open popovers between renders.
- Build the panel module with
  `cargo build --release --target wasm32-unknown-unknown --no-default-features --features panel`.
  `voidhash-cli test` builds and checks both modules, and `voidhash-cli dev`
  rebuilds both on every change to a project's components and shows them in
  the paywall editor while you edit.

The builder API, bound fields, intents and the panel ABI are documented in
the `voidhash_ui::panel` module, with which the editor's own sections are
written too. `voidhash_ui::panel::testing` runs panels in `cargo test`.

## Views and modifiers

| Constructor            | Element                                                        |
| ---------------------- | -------------------------------------------------------------- |
| `vstack()`             | Children top to bottom, stretched to the stack's width.        |
| `hstack()`             | Children left to right, centred vertically.                    |
| `zstack()`             | Children layered; the first sizes the stack, the rest fill it. |
| `view()`               | A plain container.                                             |
| `scroll()`             | A scrolling container (`.horizontal()` scrolls sideways).      |
| `text(…)`              | Text.                                                          |
| `image(url)`           | An image (`.resize_mode(ResizeMode::Cover)`).                  |
| `button(label)`        | A pressable with a label; `.prominent()` for the main action.  |
| `pressable(child)`     | Makes any view pressable.                                      |
| `spacer()`             | Takes the free space in a stack.                               |
| `divider()`            | A hairline.                                                    |
| `slot()`               | Where content placed inside the component in the editor shows. |
| `slot_named("footer")` | Where content placed in the `footer` slot shows.               |
| `canvas(\|frame\| …)`  | Per-frame drawing; see below.                                  |
| `emitter(particles)`   | A native particle effect, such as `Particles::confetti()`.     |
| `native("vh/emitter")` | A component built into the app, with `.prop(key, value)`.      |

Modifiers chain on any view:

- Layout: `.padding(16)`, `.padding_x`, `.padding_y`, `.padding_edges`,
  `.margin…`, `.spacing(12)`, `.frame(w, h)`, `.width`, `.height`,
  `.fill_width()`, `.min_width`/`.max_width`/…, `.aspect_ratio`, `.flex(1)`,
  `.align(Align::Center)`, `.justify(Justify::SpaceBetween)`, `.align_self`,
  `.wrap()`, `.absolute()` with `.top`/`.left`/`.right`/`.bottom`/`.inset`,
  `.z_index`, `.clip()`.
- Appearance: `.background(color)`, `.border(width, color)`,
  `.corner_radius(14)`, `.corner_radii(…)`, `.opacity(0.5)`,
  `.shadow(color, radius, x, y)`, `.offset(x, y)`, `.scale(1.1)`,
  `.rotate(degrees)`, `.visible(false)`.
- Text: `.font(Font::HEADLINE)`, `.color(Color::PRIMARY)`, `.text_align`,
  `.line_height`, `.letter_spacing`, `.strikethrough()`. On a `button` these
  style its label.
- Effects: `.layer_blur(4)`, `.backdrop_blur(12)`, `.blend_mode("multiply")`,
  `.outline(2, color, 3)`.
- Behaviour: `.on_tap(|cx| …)`, `.on_pointer(|cx, pointer| …)` (down, move,
  up and cancel, in the element's coordinates), `.key("id")` for list rows,
  `.transition(Transition::spring())` to animate style changes natively, and
  `.on_event(|cx, name, payload| …)` on a `native` element.
- Accessibility: `.label("…")`, `.role("header")`, `.hint("…")`,
  `.accessibility_value(…)`, `.accessibility_action("increment", "More",
|cx| …)`, and on an input `.checked(on)` for a switch and `.selected(chosen)`
  for a segment or a chip.
- Anything else: `.style("key", value)` sets a style key: an engine key
  (React Native names, longhand keys such as `paddingTop`) or a paywall
  document key such as `fills`, `shadows` or `rotation`. `lineHeight` is in
  logical pixels.

`Color` has a dark paywall palette (`BACKGROUND`, `SURFACE`, `PRIMARY`,
`SECONDARY`, `SEPARATOR`, `ACCENT`) and `Color::hex("#7c3aed")`, `.opacity`
and `.mix`. `Font` has the usual text styles (`LARGE_TITLE` to `CAPTION`),
`Font::new(size, weight)`, `.bold()` and `.semibold()`.

## State

`cx.state(|| initial)` keeps a value across renders. Changing it renders the
component again:

```rust
let count = cx.state(|| 0u32);
button(cat!("Tapped ", int(i64::from(count.get())), " times"))
    .on_tap(move |_| count.update(|count| *count += 1))
```

The handle is `Copy`: move it into as many closures as you need. `get()`
copies the value, `with(|value| …)` borrows it, `set(value)` replaces it (and
renders again only if it changed) and `update(|value| …)` changes it in place.

Like hooks in React, call `cx.state` unconditionally and in the same order on
every render.

`cx.store(|| initial)` works the same way but never renders again. Use it for
data that changes every frame, such as a game's positions, and keep the
values the tree shows (a score) in `cx.state`.

## Timers, layout and context

`cx.every(seconds, enabled, |cx| …)` runs a closure on a timer the paywall
keeps, so no component code runs in between: a countdown ticks once a
second instead of every frame. Like `cx.state`, call it on every render;
`enabled = false` stops it. Ticks are not user input, so they cannot
purchase.

`cx.layout()` is the component's laid-out size once the paywall reports it;
the component renders again when it changes. `cx.locale()`,
`cx.reduced_motion()` and `cx.color_scheme()` describe the app the paywall
shows in, and `cx.font_scale()` the text size its user chose (1 by default).

## Text size

A component's text keeps the sizes it gives unless `#[component(...)]` says
`follows_text_size`: then the paywall sizes its `text` and text field
elements for the end user's text size, as it sizes its own texts. Use it
when the text has room to grow (boxes that hug or wrap). Text in a box of a
fixed size either caps its growth with `.max_font_scale(...)` and sizes the
box from `cx.font_scale()`, or leaves `follows_text_size` out and sizes text
and box from `cx.font_scale()` itself. `.fixed_font_size()` keeps one text at
its size, such as a glyph used as an icon.

## Purchases and other actions

The closure passed to `.on_tap` receives an event context with the paywall's
actions:

| Call                       | Does                                  |
| -------------------------- | ------------------------------------- |
| `cx.purchase(&product.id)` | Purchases a product.                  |
| `cx.restore()`             | Restores previous purchases.          |
| `cx.close()`               | Closes the paywall.                   |
| `cx.open_url(url)`         | Opens a link.                         |
| `cx.track(name, props)`    | Records an analytics event.           |
| `cx.emit(action, payload)` | Fires one of the component's actions. |

Purchases, restores and links are only accepted while handling the user's
gesture (a tap, a pointer lifted over the element, an accessibility
action), so a component cannot start a purchase on its own, and only with
the matching capability. Each call returns whether the paywall accepted the
request. The purchase then runs through the SDK's purchase flow as usual.

## Inputs

A component with a value is an input: the paywall binds the value to a
variable both ways. Take it as the parameter marked `#[value]`, an
`Input<String>`, `Input<f64>` or `Input<bool>`, or an `Input<Vec<String>>`
for a list:

```rust
#[component]
pub fn Toggle(cx: Cx, #[value] on: Input<bool>) -> View {
    let now = on.get();
    text(if now { "On" } else { "Off" }).on_tap(move |cx| on.set(cx, !now))
}
```

`Input::set` writes the variable and runs the component's `change`
interactions. Like a purchase, the host takes it only while the end user is
doing something to the component: a press, a pointer event (a drag
included), an accessibility action or a text input's handlers.
`cx.begin_editing()` and `cx.end_editing()` say when the end user starts and
finishes changing the value, `cx.submit()` that they confirmed it,
`cx.set_validity(valid)` whether it is valid, and `cx.disabled()` whether
the paywall disabled the component. `#[value(secret)]` keeps the value out
of everything but the flow's outputs.

`text_input()` embeds the engine's text field, with a text input's settings
(`.placeholder`, `.keyboard`, `.secure`, `.max_length`, `.return_key`,
`.autofill`, …) and `.on_change`, `.on_submit`, `.on_focus` and `.on_blur`.
`.value(text)` is the text it holds; render another text than the one typed
to replace it. The keyboard, the selection and input methods are the
field's: a component gets no key events.

A component that has a value or calls `text_input()` is guest ABI 3; every
other component stays ABI 2. A value
declares that the component reports its validity with `#[value(validity)]`;
without it, `set_validity` is refused and the instance has no `isValid`.

## Slots, component props and written props

A `Content` prop is content the instance fills, shown with
`card.show(key, params)` once per key with its declared params
(`#[prop(params(item: String, index: f64))]`). A `ComponentProp` is a
component the instance chooses, meeting `#[prop(accepts(props(label:
String), events(chosen)))]`, created with `tile.show(key, props)` and
heard through `.on_event`. A prop marked `#[prop(writes)]` is written with
`cx.set_prop(name, value)` while the end user acts, one marked
`#[prop(computed)]` at any time. Any of these makes the component guest ABI 4.

## Canvas and particles

A canvas runs a closure every frame while it is active:

```rust
let game = cx.store(Game::new);
let score = cx.state(|| 0u32);

canvas(move |frame| {
    let dt = frame.dt();
    let taps: Vec<Pointer> = frame.taps().collect();
    let caught = game.update(|game| game.step(dt, &taps));
    score.set(caught); // renders the tree again only when the score changes
    frame.fill_rect(0.0, 0.0, frame.width(), frame.height(), Color::BACKGROUND);
    game.with(|game| {
        for coin in &game.coins {
            frame.fill_circle(coin.x, coin.y, 20.0, Color::hex("#fbbf24"));
        }
    });
})
.height(320)
.active(score.get() < 5)
```

`Frame` gives you `dt()`, `size()`, `pointers()` (with `pressed` for taps that
started this frame), `now()` and `random()`, and draws with `fill_rect`,
`fill_round_rect`, `fill_circle`, `line`, `text`, `image`, `sprites` (many
copies of an image in one batch), `save`/`restore`, `translate`, `rotate`,
`scale` and `alpha`. List the images a canvas draws with `.images([…])` and
refer to them by index. Float functions such as `math::sinf`, `math::cosf`
and `math::sqrtf` are in the prelude's `math` module.

For effects without game logic, prefer `emitter(Particles::confetti())`: the
particles animate natively without running your code every frame.

## Text without `format!`

`format!` and `core::fmt` add tens of kilobytes to a module. The prelude has
small alternatives:

```rust
cat!("Caught ", int(3), " of ", int(5))   // "Caught 3 of 5"
fixed(2.5, 2)                              // "2.5"
padded(7, 2)                               // "07"
```

## Test on your machine

Components run in ordinary `cargo test` through `voidhash_ui::testing`. The
harness mounts the component like the paywall does, gives you the rendered
tree, and presses buttons or runs canvas frames. A stand-in paywall records
the actions the component requests:

```rust
#[cfg(test)]
mod tests {
    extern crate std;
    use super::*;
    use voidhash_ui::testing::{Harness, take_actions};

    #[test]
    fn continue_purchases_the_first_plan() {
        let plans = vec![object([("id", "pro-annual".into()), ("title", "Annual".into())])];
        let mut picker = Harness::mount(&PLAN_PICKER, object([("plans", plans.into())]));
        picker.press_text("Continue");
        let purchase = take_actions().pop().unwrap().action;
        assert_eq!(purchase.get("productId").and_then(Value::as_str), Some("pro-annual"));
    }
}
```

`#[component]` generates the `PLAN_PICKER` constant from the function name.
The harness also fires timers (`advance(seconds)`), reports a layout
(`layout(width, height)`) and delivers pointer and accessibility events
(`pointer`, `accessibility_action`).

## Native builds

The same component source can be linked into an app instead of downloaded
as a module. Built with the crate's `native` feature, `#[component]` emits a
function table, `PLAN_PICKER_NATIVE`, that an app registers with the paywall
runtime under the component's id; paywalls then run it natively where the
app provides it and fall back to the module elsewhere. To build a loadable
library instead, for example to check the native build:

```toml
[lib]
crate-type = ["cdylib", "rlib"]

[features]
native = ["voidhash-ui/native"]
native-library = ["native"]
```

```rust
#[cfg(feature = "native-library")]
voidhash_ui::native_library!(PLAN_PICKER_NATIVE);
```

Build native libraries with `panic = "unwind"` so the paywall can stop a
component that panics, as it stops a module that traps.

## Limits

Components share the paywall with everything else on screen, so the runtime
enforces budgets. A component that exceeds one shows an empty box instead of
its content; the rest of the paywall keeps working.

- Memory: 16 MiB per module.
- Timers: 64 pending per instance, each at most a day away.
- Rendering and handling a tap: 50 million interpreter instructions.
- One canvas frame: 5 million instructions. A canvas whose frames take longer
  than 8 ms three times in a row is paused.

The examples render in about 300,000 instructions and run a game frame in
about 100,000.

## Using the standard library

The crate is `no_std` and brings a small allocator and a panic handler. To
build a module that links `std` instead, disable both:

```toml
voidhash-ui = { version = "0.1", default-features = false }
```

## License

MIT
