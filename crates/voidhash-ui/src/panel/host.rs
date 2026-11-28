//! The host functions a panel module imports.
//!
//! On `wasm32` this is the `vhp.log` import. On other targets (unit tests on
//! the build machine) messages go to standard error.

#[cfg(target_arch = "wasm32")]
mod imports {
    #[link(wasm_import_module = "vhp")]
    unsafe extern "C" {
        pub fn log(level: i32, text: *const u8, len: usize);
    }
}

/// Writes `text` to the host's log: 0 debug, 1 info, 2 warning, 3 error.
#[cfg(target_arch = "wasm32")]
pub(crate) fn log(level: i32, text: &str) {
    // SAFETY: the host reads `len` bytes at `text` during the call.
    unsafe { imports::log(level, text.as_ptr(), text.len()) }
}

#[cfg(not(target_arch = "wasm32"))]
pub(crate) fn log(level: i32, text: &str) {
    std::eprintln!("[panel {level}] {text}");
}
