//! The host functions a component calls.
//!
//! A WebAssembly guest (`cfg(vh_guest)`) imports them from the `vh` module.
//! A panel module (`cfg(vh_panel)`) never runs the component, so it imports
//! nothing for it: its stand-ins refuse every request and log through the
//! panel ABI's `vhp.log`. A native build calls the host table the runtime passed for the current
//! call ([`crate::native`]); outside a host call, as in unit tests on the
//! build machine, a recording stand-in answers ([`crate::testing`]).

#[cfg(vh_guest)]
mod imports {
    #[link(wasm_import_module = "vh")]
    unsafe extern "C" {
        pub fn action(value: *const u8, len: usize) -> i32;
        pub fn invalidate(instance: i32);
        pub fn now() -> f64;
        pub fn random() -> f64;
        pub fn log(level: i32, text: *const u8, len: usize);
        pub fn schedule(instance: i32, seconds: f64) -> i32;
        pub fn cancel(timer: i32);
    }
}

/// Sends an encoded action; returns whether the host accepted it.
#[cfg(vh_guest)]
pub(crate) fn action(encoded: &[u8]) -> bool {
    // SAFETY: the host reads `len` bytes at `value` during the call.
    unsafe { imports::action(encoded.as_ptr(), encoded.len()) == 1 }
}

#[cfg(vh_guest)]
pub(crate) fn invalidate(instance: i32) {
    // SAFETY: plain value call.
    unsafe { imports::invalidate(instance) }
}

#[cfg(vh_guest)]
pub(crate) fn now() -> f64 {
    // SAFETY: plain value call.
    unsafe { imports::now() }
}

#[cfg(vh_guest)]
pub(crate) fn random() -> f64 {
    // SAFETY: plain value call.
    unsafe { imports::random() }
}

#[cfg(vh_guest)]
pub(crate) fn log(level: i32, text: &str) {
    // SAFETY: the host reads `len` bytes at `text` during the call.
    unsafe { imports::log(level, text.as_ptr(), text.len()) }
}

/// Schedules a one-shot timer (ABI 2); returns its id, or -1 when refused.
#[cfg(vh_guest)]
pub(crate) fn schedule(instance: i32, seconds: f64) -> i32 {
    // SAFETY: plain value call.
    unsafe { imports::schedule(instance, seconds) }
}

#[cfg(vh_guest)]
pub(crate) fn cancel(timer: i32) {
    // SAFETY: plain value call.
    unsafe { imports::cancel(timer) }
}

#[cfg(vh_panel)]
mod panel_module {
    pub(crate) fn action(_encoded: &[u8]) -> bool {
        false
    }

    pub(crate) fn invalidate(_instance: i32) {}

    pub(crate) fn now() -> f64 {
        0.0
    }

    pub(crate) fn random() -> f64 {
        0.0
    }

    pub(crate) fn log(level: i32, text: &str) {
        crate::panel::host::log(level, text);
    }

    pub(crate) fn schedule(_instance: i32, _seconds: f64) -> i32 {
        -1
    }

    pub(crate) fn cancel(_timer: i32) {}
}

#[cfg(vh_panel)]
pub(crate) use panel_module::{action, cancel, invalidate, log, now, random, schedule};

#[cfg(all(not(vh_guest), not(vh_panel), feature = "native"))]
pub(crate) use crate::native::host::{action, cancel, invalidate, log, now, random, schedule};

#[cfg(all(not(vh_guest), not(vh_panel), not(feature = "native")))]
pub(crate) use crate::testing::stub::{action, cancel, invalidate, log, now, random, schedule};
