//! Per-frame drawing for [`canvas`](crate::view::canvas) elements.
//!
//! While a canvas is active the host calls its draw closure once per frame.
//! The closure advances its own logic by [`Frame::dt`], reads touches from
//! [`Frame::pointers`] and records draw commands the engine renders as one
//! batch.

use alloc::vec::Vec;

use crate::runtime;
use crate::style::Color;
use crate::value::Value;

/// A finger or mouse touching the canvas, in logical pixels relative to the
/// canvas's top-left corner.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Pointer {
    /// Stable id while the pointer stays in contact.
    pub id: i64,
    /// Horizontal position.
    pub x: f32,
    /// Vertical position.
    pub y: f32,
    /// Whether it is pressed.
    pub down: bool,
    /// Whether it went down since the previous frame: a tap started.
    pub pressed: bool,
    /// Whether it went up since the previous frame.
    pub released: bool,
}

/// One image in a [`Frame::sprites`] batch, drawn centred at `x`, `y`.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Sprite {
    /// Centre, horizontal.
    pub x: f32,
    /// Centre, vertical.
    pub y: f32,
    /// Width and height in logical pixels.
    pub size: f32,
    /// Rotation in radians.
    pub rotation: f32,
    /// Opacity from 0 to 1.
    pub alpha: f32,
}

impl Sprite {
    /// An unrotated, opaque sprite.
    pub const fn new(x: f32, y: f32, size: f32) -> Sprite {
        Sprite {
            x,
            y,
            size,
            rotation: 0.0,
            alpha: 1.0,
        }
    }
}

/// The input and draw list of one canvas frame.
pub struct Frame<'a> {
    pub(crate) instance: i32,
    pub(crate) dt: f32,
    pub(crate) width: f32,
    pub(crate) height: f32,
    pub(crate) pointers: &'a [Pointer],
    pub(crate) out: &'a mut Vec<u8>,
}

impl Frame<'_> {
    /// Seconds since the previous frame.
    pub fn dt(&self) -> f32 {
        self.dt
    }

    /// Canvas width and height in logical pixels.
    pub fn size(&self) -> (f32, f32) {
        (self.width, self.height)
    }

    /// Canvas width in logical pixels.
    pub fn width(&self) -> f32 {
        self.width
    }

    /// Canvas height in logical pixels.
    pub fn height(&self) -> f32 {
        self.height
    }

    /// Pointers touching or hovering the canvas.
    pub fn pointers(&self) -> &[Pointer] {
        self.pointers
    }

    /// The first pointer, if any.
    pub fn pointer(&self) -> Option<Pointer> {
        self.pointers.first().copied()
    }

    /// Pointers that went down since the previous frame (taps).
    pub fn taps(&self) -> impl Iterator<Item = Pointer> + '_ {
        self.pointers
            .iter()
            .copied()
            .filter(|pointer| pointer.pressed)
    }

    /// Seconds since the component mounted.
    pub fn now(&self) -> f64 {
        crate::host::now()
    }

    /// A random number in `[0, 1)`.
    pub fn random(&self) -> f32 {
        crate::host::random() as f32
    }

    /// Fires one of the component's declared actions.
    pub fn emit(&self, name: &str, payload: Value) -> bool {
        runtime::emit(name, payload)
    }

    /// Records an analytics event.
    pub fn track(&self, name: &str, properties: Value) -> bool {
        runtime::track(name, properties)
    }

    /// Asks the host to render the component's tree again after this frame.
    pub fn invalidate(&self) {
        runtime::mark_dirty(self.instance);
    }

    fn op(&mut self, op: u8, operands: &[f32]) {
        self.out.push(op);
        for operand in operands {
            self.out.extend_from_slice(&operand.to_le_bytes());
        }
    }

    fn color(&mut self, color: Color) {
        self.out.extend_from_slice(&color.to_u32().to_le_bytes());
    }

    /// Fills a rectangle.
    pub fn fill_rect(&mut self, x: f32, y: f32, width: f32, height: f32, color: Color) {
        self.op(1, &[x, y, width, height]);
        self.color(color);
    }

    /// Fills a rectangle with rounded corners.
    pub fn fill_round_rect(
        &mut self,
        x: f32,
        y: f32,
        width: f32,
        height: f32,
        radius: f32,
        color: Color,
    ) {
        self.op(2, &[x, y, width, height, radius]);
        self.color(color);
    }

    /// Fills a circle centred at `cx`, `cy`.
    pub fn fill_circle(&mut self, cx: f32, cy: f32, radius: f32, color: Color) {
        self.op(3, &[cx, cy, radius]);
        self.color(color);
    }

    /// Strokes a line.
    pub fn line(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, width: f32, color: Color) {
        self.op(4, &[x1, y1, x2, y2, width]);
        self.color(color);
    }

    /// Draws canvas image `index` (see [`View::images`](crate::View::images))
    /// into a rectangle.
    pub fn image(&mut self, index: u16, x: f32, y: f32, width: f32, height: f32, alpha: f32) {
        self.out.push(5);
        self.out.extend_from_slice(&index.to_le_bytes());
        for operand in [x, y, width, height, alpha] {
            self.out.extend_from_slice(&operand.to_le_bytes());
        }
    }

    /// Draws a line of text with its baseline at `y`.
    pub fn text(&mut self, x: f32, y: f32, size: f32, color: Color, text: &str) {
        let length = text.len().min(usize::from(u16::MAX));
        let text = &text.as_bytes()[..floor_char_boundary(text, length)];
        self.op(6, &[x, y, size]);
        self.color(color);
        self.out
            .extend_from_slice(&(text.len() as u16).to_le_bytes());
        self.out.extend_from_slice(text);
    }

    /// Saves the transform and opacity; pair with [`restore`](Frame::restore).
    pub fn save(&mut self) {
        self.out.push(7);
    }

    /// Restores the last saved transform and opacity.
    pub fn restore(&mut self) {
        self.out.push(8);
    }

    /// Moves the origin.
    pub fn translate(&mut self, x: f32, y: f32) {
        self.op(9, &[x, y]);
    }

    /// Rotates around the origin by `radians`.
    pub fn rotate(&mut self, radians: f32) {
        self.op(10, &[radians]);
    }

    /// Scales around the origin.
    pub fn scale(&mut self, x: f32, y: f32) {
        self.op(11, &[x, y]);
    }

    /// Multiplies the opacity of what follows.
    pub fn alpha(&mut self, alpha: f32) {
        self.op(12, &[alpha]);
    }

    /// Draws canvas image `index` once per sprite in one batch. Prefer this
    /// over many [`image`](Frame::image) calls.
    pub fn sprites(&mut self, index: u16, sprites: &[Sprite]) {
        self.out.push(13);
        self.out.extend_from_slice(&index.to_le_bytes());
        self.out
            .extend_from_slice(&(sprites.len() as u32).to_le_bytes());
        for sprite in sprites {
            for operand in [
                sprite.x,
                sprite.y,
                sprite.size,
                sprite.rotation,
                sprite.alpha,
            ] {
                self.out.extend_from_slice(&operand.to_le_bytes());
            }
        }
    }
}

fn floor_char_boundary(text: &str, mut index: usize) -> usize {
    while !text.is_char_boundary(index) {
        index -= 1;
    }
    index
}

/// Reads the pointers of a frame input and derives `pressed` and `released`
/// from the ids that were down in the previous frame (`was_down`, updated in
/// place).
pub(crate) fn read_pointers(input: &Value, was_down: &mut Vec<i64>) -> Vec<Pointer> {
    let pointers: Vec<Pointer> = input
        .get("pointers")
        .and_then(Value::as_array)
        .unwrap_or(&[])
        .iter()
        .map(|pointer| {
            let number = |key| pointer.get(key).and_then(Value::as_f64).unwrap_or(0.0);
            let id = number("id") as i64;
            let down = pointer
                .get("down")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let before = was_down.contains(&id);
            Pointer {
                id,
                x: number("x") as f32,
                y: number("y") as f32,
                down,
                pressed: down && !before,
                released: !down && before,
            }
        })
        .collect();
    was_down.clear();
    was_down.extend(pointers.iter().filter(|p| p.down).map(|p| p.id));
    pointers
}
