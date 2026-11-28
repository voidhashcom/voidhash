//! Editor panels: sections of the designer's right panel, written in Rust.
//!
//! A panel describes which controls a section shows and what they change.
//! The designer draws every control itself, so a panel written here looks
//! exactly like the built-in sections, which are written with this module
//! too.
//!
//! A panel is a function annotated with `#[panel]` that reads the selection
//! from a [`PanelCx`] and returns a [`Panel`] tree built with the builders in
//! [`tree`]. Fields bound with [`bind`] are edited by the host directly;
//! other controls take handlers that record [`Intents`]. A crate lists its
//! panels once with [`export_panels!`](crate::export_panels), which embeds
//! their `vhp.panels` manifest and the module's exports.
//!
//! # A component's own panel
//!
//! A component crate can ship a panel that edits the selected instances of
//! its component. The panel lives next to the component and shares its Rust
//! prop types (`PropEnum` enums, structs), but never reaches devices: the
//! crate is built twice, once as the component module (`module.wasm`, the
//! default build) and once with the crate's `panel` feature as the panel
//! module (`panel.wasm`), which only the editor loads.
//!
//! ```toml
//! [features]
//! default = ["runtime"]
//! # The component module, which paywalls run.
//! runtime = []
//! # The editor panel module.
//! panel = ["voidhash-ui/panel"]
//! ```
//!
//! ```ignore
//! // src/lib.rs
//! mod panel;
//!
//! #[component(id = "acme/plan-picker", /* … */)]
//! pub fn PlanPicker(cx: Cx, #[prop(default = 12)] spacing: f64) -> View { … }
//!
//! voidhash_ui::export_panels!(PLAN_PICKER => panel::SETTINGS);
//!
//! // src/panel.rs
//! use voidhash_ui::panel::prelude::*;
//!
//! #[panel(for = "acme/plan-picker", title = "Plan picker")]
//! pub fn settings(_cx: &mut PanelCx) -> Panel {
//!     panel().child(
//!         section("Plan picker").child(
//!             field("Spacing").child(number_field().icon("betweenHorizontalStart").bind(bind::prop("spacing"))),
//!         ),
//!     )
//! }
//! ```
//!
//! `#[panel(for = …)]` takes the component's own id and always has the
//! `instance` scope: the panel reads and writes the props of the selected
//! instances and the style keys of the traits the component declares, and
//! nothing else in the document. `export_panels!` names the component, so
//! its definition declares `"panel": true`, and fails to compile when a
//! panel names another component. Test panels with [`testing`] in
//! `cargo test`, next to the component's tests.
//!
//! # Panel modules
//!
//! A crate that only holds panels, such as the designer's built-in
//! sections, depends on `voidhash-ui` with the `panel` feature and declares
//! its panels with [`standalone::panel`], which may apply to any node type
//! or trait and read document data:
//!
//! ```
//! use voidhash_ui::panel::standalone::prelude::*;
//!
//! /// The scroll axis and indicator of the selected scroll views.
//! #[panel(for = "core/scrollView", title = "Scroll", order = 2, multi_selectable)]
//! pub fn scroll_settings(_cx: &mut PanelCx) -> Panel {
//!     panel().child(
//!         section("Scroll")
//!             .child(field("Horizontal").child(switch_field().bind(bind::prop("horizontal")))),
//!     )
//! }
//!
//! voidhash_ui::export_panels![SCROLL_SETTINGS];
//! ```

pub mod bind;
mod component;
mod context;
pub(crate) mod host;
mod intent;
pub(crate) mod runtime;
#[cfg(not(target_arch = "wasm32"))]
pub mod testing;
pub mod tree;

pub use bind::Bind;
#[doc(hidden)]
pub use component::{NoPanel, panel_targets};
pub use component::{PropField, enum_options};
pub use context::{
    Field, Layout, Locale, NodeLayout, ParentLayout, Rect, SelectedNode, StateOverride,
};
pub use intent::Intents;
pub use runtime::{EventCx, PanelCx, PanelDefinition, RenderFn, UiState};
pub use tree::{Args, FromArgs, Node, Opt, Panel};
/// Declares a component's own editor panel: `#[panel(for = "<the
/// component's id>")]`. The panel always has the `instance` scope, so it
/// reads and writes only the selected instances of its component.
pub use voidhash_ui_macros::component_panel as panel;

/// The panel ABI version this crate implements.
pub const ABI_VERSION: i32 = 1;

/// What both preludes hold: the builders and the types panels use.
mod builders {
    pub use super::bind;
    pub use super::tree::{
        action_editor_field, alignment_grid, button, button_group, callout, checkbox_field,
        color_field, color_picker, column, dimension_field, field, fill_field, font_field,
        gradient_stops, icon_opt, image_field, list_editor, menu, number_field, opt, panel,
        popover, popover_content, popover_trigger, product_field, reset_affordance, row, section,
        section_actions, select_field, slider_field, subsection, swatch, switch_field, text,
        text_field, toggle_group, untitled_section, untitled_subsection, variable_field,
    };
    pub use super::{Args, EventCx, Field, Intents, Node, Panel, PanelCx, UiState};
    pub use crate::value::{Map, Value, object};
    pub use alloc::boxed::Box;
    pub use alloc::string::String;
    pub use alloc::vec;
    pub use alloc::vec::Vec;
}

/// Everything a component panel needs: `use voidhash_ui::panel::prelude::*;`.
///
/// It is separate from the component prelude, whose `text`, `button` and
/// `EventCx` are the component's own; keep panel code in its own module.
pub mod prelude {
    pub use super::builders::*;
    pub use super::{PropField, enum_options, panel};
}

/// Panels of a panel module that is not a component's, such as the
/// designer's built-in sections: their `#[panel]` may apply to any node type
/// or trait, take any scope and read document data. The ABI between panel
/// modules and the designer is the panel ABI (version [`ABI_VERSION`]).
pub mod standalone {
    /// Declares a panel of a panel module.
    ///
    /// ```ignore
    /// #[panel(
    ///     for = "core/scrollView",     // or trait = "appearance", or any; repeatable
    ///     id = "scrollViewSettings",   // default: the function name in camelCase
    ///     title = "Scroll",            // default: the id
    ///     tab = "design",              // or "interaction"; default "design"
    ///     order = 2,                   // position in the right panel; default 100
    ///     multi_selectable,            // shown for several selected nodes
    ///     scope = "instance",          // default: instance with `for`, node-style otherwise
    ///     style("opacity", "blendMode"),  // the style keys the panel reads and writes
    ///     document("variables"),       // document data a document-scope panel reads
    ///     context("layout"),           // optional context groups: layout, definition, bindableVariables, instance
    /// )]
    /// pub fn scroll_view_settings(cx: &mut PanelCx) -> Panel { … }
    /// ```
    pub use voidhash_ui_macros::panel;

    /// Everything a panel module needs:
    /// `use voidhash_ui::panel::standalone::prelude::*;`.
    pub mod prelude {
        pub use super::super::builders::*;
        pub use super::panel;
    }
}

/// Lists a crate's editor panels, in the order the designer shows them, and
/// in the panel build (the `panel` feature) generates the panel module's
/// `vhp_*` exports and `vhp.panels` section. Call it once per crate.
///
/// A component crate names the constant `#[component]` generates and the
/// constants `#[panel]` generates:
///
/// ```ignore
/// voidhash_ui::export_panels!(PLAN_PICKER => panel::SETTINGS, panel::ADVANCED);
/// ```
///
/// The component's definition then declares `"panel": true`. Each panel
/// must name the component's id in `for`; a panel naming another id fails
/// to compile.
///
/// A panel module that is not a component's lists only its panels:
///
/// ```ignore
/// voidhash_ui::export_panels![SCROLL_VIEW_SETTINGS, APPEARANCE];
/// ```
#[macro_export]
macro_rules! export_panels {
    ($component:path => $($panel:path),+ $(,)?) => {
        /// The component's editor panels, in `vhp.panels` order.
        pub const PANELS: &[&$crate::panel::PanelDefinition] = &[$(&$panel),+];

        // `#[component]` reads this to declare the panel in the definition.
        impl $component {
            #[doc(hidden)]
            pub const HAS_PANEL: bool = true;
        }

        const _: () = {
            $(::core::assert!(
                $crate::panel::panel_targets($panel.manifest, $component.name),
                "a component's panel names the component's own id: #[panel(for = \"<the component's id>\")]",
            );)+
        };

        $crate::__panel_exports!(PANELS);
    };
    ($($panel:path),+ $(,)?) => {
        /// The panels this module exports, in `vhp.panels` order.
        pub const PANELS: &[&$crate::panel::PanelDefinition] = &[$(&$panel),+];

        $crate::__panel_exports!(PANELS);
    };
}

/// The `vhp.panels` section and the `vhp_*` exports of a panel module, in a
/// panel build only.
#[cfg(vh_panel)]
#[doc(hidden)]
#[macro_export]
macro_rules! __panel_exports {
    ($panels:ident) => {
        const _: () = {
            const LEN: usize = $crate::__private::panel::section_len($panels);

            #[unsafe(link_section = "vhp.panels")]
            #[used]
            static VHP_PANELS: [u8; LEN] = $crate::__private::panel::section_bytes::<LEN>($panels);

            #[unsafe(no_mangle)]
            extern "C" fn vhp_abi_version() -> i32 {
                $crate::panel::ABI_VERSION
            }

            #[unsafe(no_mangle)]
            extern "C" fn vhp_alloc(size: i32) -> i32 {
                $crate::__private::panel::wasm::alloc(size)
            }

            #[unsafe(no_mangle)]
            extern "C" fn vhp_mount(panel: i32, context: i32, len: i32) -> i32 {
                $crate::__private::panel::wasm::mount($panels, panel, context, len)
            }

            #[unsafe(no_mangle)]
            extern "C" fn vhp_update(instance: i32, context: i32, len: i32) {
                $crate::__private::panel::wasm::update(instance, context, len)
            }

            #[unsafe(no_mangle)]
            extern "C" fn vhp_render(instance: i32) -> i64 {
                $crate::__private::panel::wasm::render(instance)
            }

            #[unsafe(no_mangle)]
            extern "C" fn vhp_event(instance: i32, handler: i32, args: i32, len: i32) -> i64 {
                $crate::__private::panel::wasm::event(instance, handler, args, len)
            }

            #[unsafe(no_mangle)]
            extern "C" fn vhp_unmount(instance: i32) {
                $crate::__private::panel::wasm::unmount(instance)
            }
        };
    };
}

#[cfg(not(vh_panel))]
#[doc(hidden)]
#[macro_export]
macro_rules! __panel_exports {
    ($($ignored:tt)*) => {};
}
