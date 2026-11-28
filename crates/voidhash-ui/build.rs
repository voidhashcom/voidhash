//! Selects how the crate talks to its host. On WebAssembly without the
//! `native` feature the crate builds a module: a component module importing
//! the `vh` host functions (`cfg(vh_guest)`), or with the `panel` feature
//! the crate's editor panel module (`cfg(vh_panel)`), which imports only the
//! panel ABI's `vhp` functions. Every other build links natively, against
//! the native target's host table or, in unit tests, a stand-in host.

fn main() {
    // Without this, cargo reruns the script whenever any file of the package
    // looks newer, which a copied target directory (the component build
    // service's precompiled template) can make every file look.
    println!("cargo::rerun-if-changed=build.rs");
    println!("cargo::rustc-check-cfg=cfg(vh_guest)");
    println!("cargo::rustc-check-cfg=cfg(vh_panel)");
    let wasm = std::env::var("CARGO_CFG_TARGET_ARCH").is_ok_and(|arch| arch == "wasm32");
    let native = std::env::var_os("CARGO_FEATURE_NATIVE").is_some();
    let panel = std::env::var_os("CARGO_FEATURE_PANEL").is_some();
    if wasm && !native {
        println!(
            "cargo::rustc-cfg={}",
            if panel { "vh_panel" } else { "vh_guest" }
        );
    }
}
