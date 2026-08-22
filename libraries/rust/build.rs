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
    let spec: openapiv3::OpenAPI =
        serde_json::from_str(&content).expect("spec is not a valid OpenAPI document");

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

fn main() {
    generate("core-3.0.rust.json", "core");
    generate("event-capture-3.0.rust.json", "eventcapture");
}
