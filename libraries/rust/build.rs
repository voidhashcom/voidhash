//! Codegen: builds the typed API surface from committed OpenAPI documents.
//!
//! Sources are the specs downgraded to OpenAPI 3.0.x with flattened error
//! types (`*.rust.json`, produced by `voidhash/scripts/openapi-downgrade.mjs`)
//! because progenitor requires every operation's error responses to share a
//! single type. The DX layer re-derives the specific error tag from the
//! response body.

use std::path::PathBuf;

fn generate(spec_file: &str, module_name: &str) {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/generated-clients/openapi")
        .join(spec_file);
    println!("cargo:rerun-if-changed={}", path.display());

    let content = std::fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()));
    let mut document: serde_json::Value =
        serde_json::from_str(&content).expect("spec is not valid JSON");
    drop_nullable_from_optional_headers(&mut document);
    let spec: openapiv3::OpenAPI =
        serde_json::from_value(document).expect("spec is not a valid OpenAPI document");

    let mut settings = progenitor::GenerationSettings::new();
    settings.with_interface(progenitor::InterfaceStyle::Positional);

    let mut generator = progenitor::Generator::new(&settings);
    let tokens = generator
        .generate_tokens(&spec)
        .expect("progenitor failed to generate from the spec");
    let formatted = prettyplease::unparse(
        &syn::parse2::<syn::File>(tokens).expect("generated code is not valid Rust"),
    );

    let output = PathBuf::from(std::env::var("OUT_DIR").unwrap()).join(format!("{module_name}.rs"));
    std::fs::write(output, formatted).expect("failed to write generated code");
}

/// progenitor emits `value.to_string()` for a header whose schema is
/// `nullable`, which does not compile once the parameter is also optional and
/// the value is already an `Option`. Optionality is carried by `required`
/// alone, so the redundant `nullable` is dropped before generation.
fn drop_nullable_from_optional_headers(document: &mut serde_json::Value) {
    let Some(paths) = document.get_mut("paths").and_then(|paths| paths.as_object_mut()) else {
        return;
    };
    for path_item in paths.values_mut() {
        let Some(operations) = path_item.as_object_mut() else {
            continue;
        };
        for operation in operations.values_mut() {
            let Some(parameters) = operation
                .get_mut("parameters")
                .and_then(|parameters| parameters.as_array_mut())
            else {
                continue;
            };
            for parameter in parameters {
                let is_optional_header = parameter["in"] == "header"
                    && parameter["required"] != serde_json::Value::Bool(true);
                if is_optional_header {
                    if let Some(schema) = parameter.get_mut("schema").and_then(|s| s.as_object_mut())
                    {
                        schema.remove("nullable");
                    }
                }
            }
        }
    }
}

fn main() {
    generate("core-3.0.rust.json", "core");
    generate("event-capture-3.0.rust.json", "eventcapture");
}
