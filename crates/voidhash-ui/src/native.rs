//! The native target: a component linked into an application instead of
//! built as a WebAssembly module.
//!
//! `#[component]` with the `native` feature emits a [`NativeModule`]: the
//! guest calls as a C-compatible table of functions. The runtime registers
//! it under the component's definition id and calls it with a host table
//! for the duration of each call, so the component's code is the same as
//! in its WebAssembly build and talks to the same host functions.

use core::cell::Cell;
use core::ffi::c_void;

use crate::runtime::{self, RenderFn};

/// Bytes a native module returns; valid until its next call. A null pointer
/// reports that the call failed.
#[repr(C)]
#[derive(Clone, Copy, Debug)]
pub struct NativeBytes {
    /// The first byte, or null.
    pub pointer: *const u8,
    /// The number of bytes.
    pub length: usize,
}

impl NativeBytes {
    const FAILED: NativeBytes = NativeBytes {
        pointer: core::ptr::null(),
        length: 0,
    };
}

/// The host functions, the `vh` imports of a WebAssembly guest. `context`
/// is passed back to every function.
#[repr(C)]
pub struct NativeHost {
    /// The host's state for this call.
    pub context: *mut c_void,
    /// `vh.action`.
    pub action: unsafe extern "C" fn(*mut c_void, *const u8, usize) -> i32,
    /// `vh.invalidate`.
    pub invalidate: unsafe extern "C" fn(*mut c_void, i32),
    /// `vh.now`.
    pub now: unsafe extern "C" fn(*mut c_void) -> f64,
    /// `vh.random`.
    pub random: unsafe extern "C" fn(*mut c_void) -> f64,
    /// `vh.log`.
    pub log: unsafe extern "C" fn(*mut c_void, i32, *const u8, usize),
    /// `vh.schedule`.
    pub schedule: unsafe extern "C" fn(*mut c_void, i32, f64) -> i32,
    /// `vh.cancel`.
    pub cancel: unsafe extern "C" fn(*mut c_void, i32),
}

/// A component's native build: the guest calls as functions.
#[repr(C)]
pub struct NativeModule {
    /// The guest ABI the module implements (2 or 3).
    pub abi: u32,
    /// The component definition (UTF-8 JSON), static.
    pub manifest: NativeBytes,
    /// Returns the new instance's id, or a negative error.
    pub mount: unsafe extern "C" fn(*const NativeHost, *const u8, usize) -> i32,
    /// Returns 0, or a negative error.
    pub update: unsafe extern "C" fn(*const NativeHost, i32, *const u8, usize) -> i32,
    /// The encoded element tree.
    pub render: unsafe extern "C" fn(*const NativeHost, i32) -> NativeBytes,
    /// Returns bit 0 = the tree changed, or a negative error.
    pub event: unsafe extern "C" fn(*const NativeHost, i32, i32, *const u8, usize) -> i32,
    /// The draw list of one canvas frame.
    pub frame:
        unsafe extern "C" fn(*const NativeHost, i32, i32, f64, *const u8, usize) -> NativeBytes,
    /// Returns 0, or a negative error.
    pub layout: unsafe extern "C" fn(*const NativeHost, i32, f64, f64) -> i32,
    /// Frees an instance.
    pub unmount: unsafe extern "C" fn(*const NativeHost, i32),
}

// SAFETY: the table holds function pointers and a pointer to static,
// immutable manifest bytes.
unsafe impl Sync for NativeModule {}
// SAFETY: as above.
unsafe impl Send for NativeModule {}

impl NativeModule {
    /// The table of a component whose definition is `manifest` and whose
    /// tree `render` builds. Used by `#[component]`.
    #[doc(hidden)]
    pub const fn new(
        manifest: &'static [u8],
        render: unsafe extern "C" fn(*const NativeHost, i32) -> NativeBytes,
        abi: u32,
    ) -> NativeModule {
        NativeModule {
            abi,
            manifest: NativeBytes {
                pointer: manifest.as_ptr(),
                length: manifest.len(),
            },
            mount,
            update,
            render,
            event,
            frame,
            layout,
            unmount,
        }
    }
}

std::thread_local! {
    /// The host table of the call running on this thread.
    static HOST: Cell<*const NativeHost> = const { Cell::new(core::ptr::null()) };
}

/// Runs `call` with `host` as the current host, catching a panic (a
/// component's failure, logged before it unwinds). Restores the previous
/// host, so nested calls are safe.
fn hosted<R>(host: *const NativeHost, call: impl FnOnce() -> R) -> Option<R> {
    let previous = HOST.with(|current| current.replace(host));
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(call)).ok();
    HOST.with(|current| current.set(previous));
    result
}

/// # Safety
///
/// `pointer` must be valid for `length` bytes.
unsafe fn input<'a>(pointer: *const u8, length: usize) -> &'a [u8] {
    if pointer.is_null() || length == 0 {
        return &[];
    }
    // SAFETY: guaranteed by the caller.
    unsafe { core::slice::from_raw_parts(pointer, length) }
}

fn output((pointer, length): (*const u8, usize)) -> NativeBytes {
    NativeBytes { pointer, length }
}

unsafe extern "C" fn mount(host: *const NativeHost, props: *const u8, length: usize) -> i32 {
    // SAFETY: the host passes its props for the call.
    let props = unsafe { input(props, length) };
    hosted(host, || runtime::mount(props)).unwrap_or(-3)
}

unsafe extern "C" fn update(
    host: *const NativeHost,
    instance: i32,
    props: *const u8,
    length: usize,
) -> i32 {
    // SAFETY: the host passes its props for the call.
    let props = unsafe { input(props, length) };
    hosted(host, || runtime::update(instance, props)).map_or(-1, |()| 0)
}

/// `render` of a component's table: renders with the component's
/// generated `render`. Used by `#[component]`.
///
/// # Safety
///
/// `host` must be a valid host table for the call.
#[doc(hidden)]
pub unsafe fn render(host: *const NativeHost, instance: i32, render: RenderFn) -> NativeBytes {
    hosted(host, || output(runtime::render(instance, render))).unwrap_or(NativeBytes::FAILED)
}

unsafe extern "C" fn event(
    host: *const NativeHost,
    instance: i32,
    handler: i32,
    event: *const u8,
    length: usize,
) -> i32 {
    // SAFETY: the host passes its event for the call.
    let event = unsafe { input(event, length) };
    hosted(host, || runtime::event(instance, handler, event)).unwrap_or(-1)
}

unsafe extern "C" fn frame(
    host: *const NativeHost,
    instance: i32,
    canvas: i32,
    dt: f64,
    input_bytes: *const u8,
    length: usize,
) -> NativeBytes {
    // SAFETY: the host passes its input for the call.
    let frame_input = unsafe { input(input_bytes, length) };
    hosted(host, || {
        output(runtime::frame(instance, canvas, dt, frame_input))
    })
    .unwrap_or(NativeBytes::FAILED)
}

unsafe extern "C" fn layout(
    host: *const NativeHost,
    instance: i32,
    width: f64,
    height: f64,
) -> i32 {
    hosted(host, || runtime::layout(instance, width, height)).map_or(-1, |()| 0)
}

unsafe extern "C" fn unmount(host: *const NativeHost, instance: i32) {
    hosted(host, || runtime::unmount(instance));
}

/// The host functions of a native build: the current call's host table, or
/// the stand-in host outside one.
pub(crate) mod host {
    use super::HOST;

    fn with<R>(call: impl FnOnce(&super::NativeHost) -> R) -> Option<R> {
        let host = HOST.with(core::cell::Cell::get);
        // SAFETY: a non-null pointer is the table the host passed for the
        // call running on this thread (see `hosted`).
        (!host.is_null()).then(|| call(unsafe { &*host }))
    }

    pub(crate) fn action(encoded: &[u8]) -> bool {
        // SAFETY: the host reads `len` bytes at `value` during the call.
        with(|host| unsafe { (host.action)(host.context, encoded.as_ptr(), encoded.len()) == 1 })
            .unwrap_or_else(|| crate::testing::stub::action(encoded))
    }

    pub(crate) fn invalidate(instance: i32) {
        // SAFETY: plain value call into the host table.
        with(|host| unsafe { (host.invalidate)(host.context, instance) })
            .unwrap_or_else(|| crate::testing::stub::invalidate(instance));
    }

    pub(crate) fn now() -> f64 {
        // SAFETY: plain value call into the host table.
        with(|host| unsafe { (host.now)(host.context) }).unwrap_or_else(crate::testing::stub::now)
    }

    pub(crate) fn random() -> f64 {
        // SAFETY: plain value call into the host table.
        with(|host| unsafe { (host.random)(host.context) })
            .unwrap_or_else(crate::testing::stub::random)
    }

    pub(crate) fn log(level: i32, text: &str) {
        // SAFETY: the host reads `len` bytes at `text` during the call.
        with(|host| unsafe { (host.log)(host.context, level, text.as_ptr(), text.len()) })
            .unwrap_or_else(|| crate::testing::stub::log(level, text));
    }

    pub(crate) fn schedule(instance: i32, seconds: f64) -> i32 {
        // SAFETY: plain value call into the host table.
        with(|host| unsafe { (host.schedule)(host.context, instance, seconds) })
            .unwrap_or_else(|| crate::testing::stub::schedule(instance, seconds))
    }

    pub(crate) fn cancel(timer: i32) {
        // SAFETY: plain value call into the host table.
        with(|host| unsafe { (host.cancel)(host.context, timer) })
            .unwrap_or_else(|| crate::testing::stub::cancel(timer));
    }
}
