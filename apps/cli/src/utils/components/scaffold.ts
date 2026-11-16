/** What `voidhash-cli new` scaffolds a component for. */
export interface ComponentScaffoldOptions {
  /** The component slug: kebab-case, the name of its directory and the second segment of its id. */
  readonly name: string;
  /** Letters, digits and spaces only, so it needs no escaping in Rust. */
  readonly title: string;
}

/**
 * The id of a working copy's component, which `#[component]` and
 * `#[panel(for = …)]` both name: `project/<slug>`.
 */
export const workingCopyComponentId = (slug: string) => `project/${slug}`;

/** `plan-picker` → `PlanPicker`, the component function's name. */
const pascalCase = (name: string) =>
  name
    .split("-")
    .filter((part) => part !== "")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("");

/**
 * `PlanPicker` → `PLAN_PICKER`: the constant `#[component]` generates for a
 * function, whose words start at each capital that follows a lowercase
 * letter or digit.
 */
const constantName = (functionName: string) =>
  functionName.replace(/(?<=[^A-Z])(?=[A-Z])/g, "_").toUpperCase();

/**
 * The `Cargo.toml` of a component crate in the working copy. It has no
 * `[workspace]` or `[profile.*]` tables: those belong to the working copy's
 * workspace manifest.
 */
export const componentCargoToml = (slug: string) => `[package]
name = "${slug}"
version = "0.1.0"
edition = "2024"
publish = false

[lib]
crate-type = ["cdylib"]

# The crate builds twice: by default the component module paywalls run, and
# with \`--no-default-features --features panel\` its editor panel module.
[features]
default = ["runtime"]
runtime = []
panel = ["voidhash-ui/panel"]

[dependencies]
voidhash-ui = "0.1"
`;

const libRs = (options: ComponentScaffoldOptions) => {
  const { name, title } = options;
  return `//! ${title}: a Voidhash paywall component with its editor panel.

#![no_std]

use voidhash_ui::prelude::*;

mod panel;

/// The badge's outline. The component and its editor panel share this type.
#[derive(Clone, Copy, Debug, PartialEq, PropEnum)]
pub enum Shape {
    /// Fully rounded ends.
    Pill,
    /// Slightly rounded corners.
    Square,
}

/// A label on an accent-colored badge.
// The id is \`project/${name}\`, after the component's directory;
// \`#[panel(for = …)]\` in src/panel.rs names the same id.
#[component(
    id = "${workingCopyComponentId(name)}",
    title = "${title}",
    traits(frame(resize = "both"), appearance, effects),
    size(width = "hug", height = "hug")
)]
pub fn ${pascalCase(name)}(
    _cx: Cx,
    #[prop(default = "New")] label: String,
    #[prop(default = "#7c3aed")] accent: Color,
    shape: Shape,
    #[prop(default = 12, min = 0, max = 32, step = 1, unit = "px")] padding: f64,
) -> View {
    text(label)
        .color(Color::WHITE)
        .padding_x(padding)
        .padding_y(6)
        .corner_radius(match shape {
            Shape::Pill => 999,
            Shape::Square => 6,
        })
        .background(accent)
}

voidhash_ui::export_panels!(${constantName(pascalCase(name))} => panel::SETTINGS);
`;
};

const panelRs = (options: ComponentScaffoldOptions) => {
  const { title } = options;
  const id = workingCopyComponentId(options.name);
  return `//! The badge's section in the paywall editor's right panel.
//!
//! The editor draws it with its own controls. Bound fields are edited by the
//! editor directly (scrubbing, Mixed values, one undo step per gesture); the
//! panel only describes which fields show.

use voidhash_ui::panel::prelude::*;

use crate::Shape;

/// The label, accent and shape, and the padding of pill badges.
#[panel(for = "${id}", title = "${title}", multi_selectable)]
pub fn settings(cx: &mut PanelCx) -> Panel {
    let mut section = section("${title}")
        .child(field("Label").child(text_field().placeholder("New").bind(bind::prop("label"))))
        .child(field("Accent").child(color_field().format("hex").bind(bind::prop("accent"))))
        .child(
            field("Shape").child(
                toggle_group()
                    .width("full")
                    .options(enum_options::<Shape>())
                    .bind(bind::prop("shape")),
            ),
        );
    // Square badges keep their padding; only pills offer it.
    if cx.prop("shape").read::<Shape>() == Shape::Pill {
        section = section.child(
            field("Padding").child(
                number_field()
                    .icon("square")
                    .min(0)
                    .max(32)
                    .step(1)
                    .bind(bind::prop("padding").range(0.0, 32.0).decimals(0)),
            ),
        );
    }
    panel().child(section)
}

#[cfg(test)]
mod tests {
    extern crate std;

    use super::*;
    use voidhash_ui::panel::testing::{Harness, find};

    fn bound(tree: &Value, prop: &str) -> bool {
        find(tree, |node| {
            node.get("bind").and_then(|bind| bind.get("prop")).and_then(Value::as_str) == Some(prop)
        })
        .is_some()
    }

    #[test]
    fn offers_padding_only_for_pills() {
        let context = |shape: &str| {
            std::format!(
                r#"{{ "selection": [{{ "id": "a", "type": "component", "definition": "${id}" }}],
                    "props": {{ "shape": {{ "value": "{shape}", "mixed": false, "isDefault": false }} }} }}"#
            )
        };
        let mut harness = Harness::mount(&SETTINGS, &context("pill"));
        assert!(bound(&harness.render(), "padding"));
        harness.update(&context("square"));
        assert!(!bound(&harness.render(), "padding"));
    }
}
`;
};

/**
 * The files of a new component of the working copy, by crate-relative path:
 * a buildable `voidhash-ui` component and its editor panel, both with the id
 * `project/<slug>`.
 */
export const componentCrateFiles = (
  options: ComponentScaffoldOptions,
): Readonly<Record<string, string>> => ({
  "Cargo.toml": componentCargoToml(options.name),
  "src/lib.rs": libRs(options),
  "src/panel.rs": panelRs(options),
});
