//! Write Voidhash paywall components in Rust.
//!
//! A component is a function annotated with [`#[component]`](component) that
//! takes its props and returns a [`View`] tree built with a SwiftUI-like
//! builder API. The crate compiles to a small WebAssembly module that paywalls
//! load at runtime and render natively on iOS, Android and the web.
//!
//! ```ignore
//! #![no_std]
//! use voidhash_ui::prelude::*;
//!
//! /// A button that buys the product.
//! #[component]
//! pub fn BuyButton(cx: Cx, product: Product) -> View {
//!     let label = cat!("Get ", product.title, " for ", product.price);
//!     button(label).prominent().on_tap(move |cx| cx.purchase(&product.id))
//! }
//! ```
//!
//! See the crate README for building, testing and the size-optimised
//! release profile.

#![no_std]
// A panel build compiles the component runtime only for the types the
// crate's component declares; nothing calls into it.
#![cfg_attr(vh_panel, allow(dead_code))]

extern crate alloc;
// `#[component]` and `#[panel]` expansions name the crate by path, inside it
// too (its tests and documentation examples).
extern crate self as voidhash_ui;
#[cfg(not(any(vh_guest, vh_panel)))]
extern crate std;

pub mod canvas;
mod host;
#[cfg(all(not(vh_guest), feature = "native"))]
pub mod native;
pub mod numbers;
pub mod panel;
pub mod particles;
pub mod props;
mod runtime;
pub mod style;
#[cfg(not(any(vh_guest, vh_panel)))]
pub mod testing;
pub mod value;
pub mod view;

pub use canvas::{Frame, Pointer, Sprite};
pub use particles::{Particles, Shape};
pub use props::{
    Asset, ComponentProp, Content, Fill, Image, Product, ProductId, Prop, PropEnum, ScalarProp,
};
pub use runtime::{Component, Cx, EventCx, Input, InputValue, Phase, RenderFn, State, Store};
pub use style::{
    Align, Autofill, Capitalization, Color, Curve, Font, Justify, Keyboard, ResizeMode, ReturnKey,
    TextAlign, Transition,
};
pub use value::{Map, Value, object};
pub use view::{PointerEvent, PointerPhase, TextChange, View};
pub use voidhash_ui_macros::{PropEnum, component};

/// Float math (`sin`, `cos`, `sqrt`, `floor`, …) without the standard
/// library.
pub mod math {
    pub use libm::{
        atan2f, ceilf, cosf, expf, fabsf, floorf, fmaxf, fminf, hypotf, powf, roundf, sinf, sqrtf,
    };
    /// π as `f32`.
    pub const PI: f32 = core::f32::consts::PI;
    /// 2π as `f32`.
    pub const TAU: f32 = core::f32::consts::TAU;
}

/// Everything a component needs: `use voidhash_ui::prelude::*;`.
pub mod prelude {
    pub use crate::cat;
    pub use crate::math;
    pub use crate::numbers::{fixed, int, padded};
    pub use crate::view::{
        button, canvas, divider, emitter, hstack, image, native, pressable, scroll, slot,
        slot_named, spacer, text, text_input, view, vstack, zstack,
    };
    pub use crate::{
        Align, Asset, Autofill, Capitalization, Color, Component, ComponentProp, Content, Curve,
        Cx, EventCx, Fill, Font, Frame, Image, Input, Justify, Keyboard, Particles, Pointer,
        PointerEvent, PointerPhase, Product, ProductId, PropEnum, ResizeMode, ReturnKey, Shape,
        Sprite, State, Store, TextAlign, TextChange, Transition, Value, View, component, object,
    };
    pub use alloc::boxed::Box;
    pub use alloc::string::String;
    pub use alloc::vec;
    pub use alloc::vec::Vec;
}

/// Used by `#[component]` expansions. Not a stable API.
#[doc(hidden)]
pub mod __private {
    pub use crate::panel::NoPanel;
    pub use crate::props::declares;
    pub use alloc::string::String;

    use crate::props::{Prop, read};
    use crate::value::Value;

    /// Reads a prop with its encoded manifest default.
    pub fn prop<T: Prop>(props: &Value, name: &str, default: &[u8]) -> T {
        read(props, name, default)
    }

    /// The length of a manifest assembled from `parts` at compile time.
    pub const fn manifest_length(parts: &[&str]) -> usize {
        let mut length = 0;
        let mut index = 0;
        while index < parts.len() {
            length += parts[index].len();
            index += 1;
        }
        length
    }

    /// The bytes of a manifest assembled from `parts` at compile time:
    /// literal JSON and the parts the compiler fills in, such as an enum
    /// prop's options.
    pub const fn manifest_bytes<const N: usize>(parts: &[&str]) -> [u8; N] {
        let mut out = [0u8; N];
        let mut at = 0;
        let mut index = 0;
        while index < parts.len() {
            let bytes = parts[index].as_bytes();
            let mut offset = 0;
            while offset < bytes.len() {
                out[at] = bytes[offset];
                at += 1;
                offset += 1;
            }
            index += 1;
        }
        out
    }

    /// Used by `export_panels!` expansions in a panel module.
    pub mod panel {
        pub use crate::panel::runtime::{section_bytes, section_len};

        /// The `vhp_*` exports, called by the functions `export_panels!`
        /// exports.
        #[cfg(target_arch = "wasm32")]
        pub mod wasm {
            use crate::panel::runtime::{self, PanelDefinition};

            fn pack((pointer, len): (*const u8, usize)) -> i64 {
                ((pointer as u32 as i64) << 32) | len as u32 as i64
            }

            /// Runs `consume` on the input the host wrote into a `vhp_alloc`
            /// buffer.
            fn with_input<R>(pointer: i32, len: i32, consume: impl FnOnce(&[u8]) -> R) -> R {
                let Ok(len) = usize::try_from(len) else {
                    runtime::fail("negative input length");
                };
                let buffer = runtime::take_input(pointer as usize as *const u8, len);
                consume(&buffer[..len])
            }

            pub fn alloc(size: i32) -> i32 {
                match usize::try_from(size) {
                    Ok(size) => runtime::alloc(size) as usize as i32,
                    Err(_) => 0,
                }
            }

            pub fn mount(panels: &[&PanelDefinition], panel: i32, context: i32, len: i32) -> i32 {
                with_input(context, len, |context| {
                    runtime::mount(panels, panel, context)
                })
            }

            pub fn update(instance: i32, context: i32, len: i32) {
                with_input(context, len, |context| runtime::update(instance, context));
            }

            pub fn render(instance: i32) -> i64 {
                pack(runtime::render(instance))
            }

            pub fn event(instance: i32, handler: i32, args: i32, len: i32) -> i64 {
                with_input(args, len, |args| {
                    pack(runtime::event(instance, handler, args))
                })
            }

            pub fn unmount(instance: i32) {
                runtime::unmount(instance);
            }
        }
    }

    /// The `vh_*` exports, called by the functions `#[component]` exports.
    #[cfg(vh_guest)]
    pub mod wasm {
        use crate::runtime::{self, RenderFn};

        fn pack((pointer, len): (*const u8, usize)) -> i64 {
            ((pointer as u32 as i64) << 32) | len as u32 as i64
        }

        /// Runs `consume` on the input the host wrote into a `vh_alloc` buffer.
        fn with_input<R>(pointer: i32, len: i32, consume: impl FnOnce(&[u8]) -> R) -> R {
            let Ok(len) = usize::try_from(len) else {
                runtime::fail("negative input length");
            };
            let buffer = runtime::take_input(pointer as usize as *const u8, len);
            consume(&buffer[..len])
        }

        pub fn alloc(size: i32) -> i32 {
            match usize::try_from(size) {
                Ok(size) => runtime::alloc(size) as usize as i32,
                Err(_) => 0,
            }
        }

        pub fn mount(props: i32, len: i32) -> i32 {
            with_input(props, len, runtime::mount)
        }

        pub fn update(instance: i32, props: i32, len: i32) {
            with_input(props, len, |props| runtime::update(instance, props));
        }

        pub fn render(instance: i32, render: RenderFn) -> i64 {
            pack(runtime::render(instance, render))
        }

        pub fn event(instance: i32, handler: i32, event: i32, len: i32) -> i32 {
            with_input(event, len, |event| runtime::event(instance, handler, event))
        }

        pub fn frame(instance: i32, canvas: i32, dt: f64, input: i32, len: i32) -> i64 {
            with_input(input, len, |input| {
                pack(runtime::frame(instance, canvas, dt, input))
            })
        }

        pub fn unmount(instance: i32) {
            runtime::unmount(instance);
        }

        pub fn layout(instance: i32, width: f64, height: f64) {
            runtime::layout(instance, width, height);
        }
    }
}

/// A component's manifest as a `&'static str`, assembled from its parts.
#[doc(hidden)]
#[macro_export]
macro_rules! __manifest {
    ($parts:path) => {{
        const LENGTH: usize = $crate::__private::manifest_length($parts);
        const BYTES: [u8; LENGTH] = $crate::__private::manifest_bytes::<LENGTH>($parts);
        match ::core::str::from_utf8(&BYTES) {
            Ok(text) => text,
            Err(_) => panic!("a component manifest is UTF-8"),
        }
    }};
}

/// The `vh_*` exports and the `vh.manifest` section of a WebAssembly guest.
#[cfg(vh_guest)]
#[doc(hidden)]
#[macro_export]
macro_rules! __guest_exports {
    ($render:path, $parts:path, $abi:literal) => {
        const _: () = {
            const LENGTH: usize = $crate::__private::manifest_length($parts);
            #[unsafe(link_section = "vh.manifest")]
            #[used]
            static MANIFEST: [u8; LENGTH] = $crate::__private::manifest_bytes::<LENGTH>($parts);

            #[unsafe(no_mangle)]
            extern "C" fn vh_abi_version() -> i32 {
                $abi
            }

            #[unsafe(no_mangle)]
            extern "C" fn vh_alloc(size: i32) -> i32 {
                $crate::__private::wasm::alloc(size)
            }

            #[unsafe(no_mangle)]
            extern "C" fn vh_mount(props: i32, len: i32) -> i32 {
                $crate::__private::wasm::mount(props, len)
            }

            #[unsafe(no_mangle)]
            extern "C" fn vh_update(instance: i32, props: i32, len: i32) {
                $crate::__private::wasm::update(instance, props, len)
            }

            #[unsafe(no_mangle)]
            extern "C" fn vh_render(instance: i32) -> i64 {
                $crate::__private::wasm::render(instance, $render)
            }

            #[unsafe(no_mangle)]
            extern "C" fn vh_event(instance: i32, handler: i32, event: i32, len: i32) -> i32 {
                $crate::__private::wasm::event(instance, handler, event, len)
            }

            #[unsafe(no_mangle)]
            extern "C" fn vh_frame(
                instance: i32,
                canvas: i32,
                dt: f64,
                input: i32,
                len: i32,
            ) -> i64 {
                $crate::__private::wasm::frame(instance, canvas, dt, input, len)
            }

            #[unsafe(no_mangle)]
            extern "C" fn vh_layout(instance: i32, width: f64, height: f64) {
                $crate::__private::wasm::layout(instance, width, height)
            }

            #[unsafe(no_mangle)]
            extern "C" fn vh_unmount(instance: i32) {
                $crate::__private::wasm::unmount(instance)
            }
        };
    };
}

#[cfg(not(vh_guest))]
#[doc(hidden)]
#[macro_export]
macro_rules! __guest_exports {
    ($($ignored:tt)*) => {};
}

/// The native build of a component: its function table.
#[cfg(all(not(vh_guest), feature = "native"))]
#[doc(hidden)]
#[macro_export]
macro_rules! __native_module {
    ($visibility:vis $name:ident, $render:path, $parts:path, $abi:literal) => {
        /// The component's native build, for registering with a runtime
        /// under its definition id.
        $visibility static $name: $crate::native::NativeModule = {
            const LENGTH: usize = $crate::__private::manifest_length($parts);
            static MANIFEST: [u8; LENGTH] = $crate::__private::manifest_bytes::<LENGTH>($parts);
            unsafe extern "C" fn render(
                host: *const $crate::native::NativeHost,
                instance: i32,
            ) -> $crate::native::NativeBytes {
                // SAFETY: the runtime passes its host table for the call.
                unsafe { $crate::native::render(host, instance, $render) }
            }
            $crate::native::NativeModule::new(&MANIFEST, render, $abi)
        };

    };
}

/// Exports a component's native build as the entry point of a loadable
/// library (`vh_native_module`), for hosts and tools that load native
/// components dynamically. A binary links at
/// most one such library entry point, so invoke it only in a crate built as
/// a `cdylib`, typically behind a feature of that crate:
///
/// ```ignore
/// #[cfg(feature = "native-library")]
/// voidhash_ui::native_library!(COUNTDOWN_OFFER_NATIVE);
/// ```
#[cfg(all(not(vh_guest), feature = "native"))]
#[macro_export]
macro_rules! native_library {
    ($module:path) => {
        /// The entry point of this component library.
        #[unsafe(no_mangle)]
        pub extern "C" fn vh_native_module() -> *const $crate::native::NativeModule {
            &$module
        }
    };
}

#[cfg(not(all(not(vh_guest), feature = "native")))]
#[doc(hidden)]
#[macro_export]
macro_rules! __native_module {
    ($($ignored:tt)*) => {};
}

#[cfg(all(any(vh_guest, vh_panel), feature = "allocator"))]
#[global_allocator]
static ALLOCATOR: dlmalloc::GlobalDlmalloc = dlmalloc::GlobalDlmalloc;

// The allocator and panic handler of both kinds of module: each module links
// this library once, so each has exactly one of each.

/// Logs the panic message and location without `core::fmt`, then traps so
/// the host quarantines the instance (or, in a panel module, shows the
/// panel's error state).
#[cfg(all(any(vh_guest, vh_panel), feature = "panic-handler"))]
#[panic_handler]
fn panic(info: &core::panic::PanicInfo<'_>) -> ! {
    let mut text = [0u8; 256];
    let mut length = 0;
    let mut push = |part: &[u8]| {
        let count = part.len().min(text.len() - length);
        text[length..length + count].copy_from_slice(&part[..count]);
        length += count;
    };
    push(b"panic: ");
    push(
        info.message()
            .as_str()
            .unwrap_or("formatted message")
            .as_bytes(),
    );
    if let Some(location) = info.location() {
        push(b" at ");
        push(location.file().as_bytes());
        push(b":");
        let mut digits = [0u8; 10];
        let mut line = location.line();
        let mut start = digits.len();
        loop {
            start -= 1;
            digits[start] = b'0' + (line % 10) as u8;
            line /= 10;
            if line == 0 {
                break;
            }
        }
        push(&digits[start..]);
    }
    // Truncation may split a character; log the valid prefix.
    let message = match core::str::from_utf8(&text[..length]) {
        Ok(message) => message,
        Err(error) => core::str::from_utf8(&text[..error.valid_up_to()]).unwrap_or("panic"),
    };
    host::log(3, message);
    core::arch::wasm32::unreachable()
}
