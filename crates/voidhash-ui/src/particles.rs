//! Particle emitter configuration for [`emitter`](crate::view::emitter).

use alloc::vec::Vec;

use crate::style::Color;
use crate::value::write::{
    write_array_header, write_bool, write_key, write_number, write_object_header, write_string,
};

/// Particle shape.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Shape {
    /// Round particles.
    Circle,
    /// Rectangles; they rotate with [`Particles::spin`].
    Rect,
}

/// How an emitter releases particles. Every setting is optional; the host
/// applies its defaults for the ones left unset.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Particles {
    rate: Option<f64>,
    burst: Option<f64>,
    lifetime: Option<f64>,
    speed: Option<[f64; 2]>,
    angle: Option<[f64; 2]>,
    gravity: Option<[f64; 2]>,
    size: Option<[f64; 2]>,
    colors: Vec<Color>,
    fade: Option<bool>,
    spin: Option<[f64; 2]>,
    shape: Option<Shape>,
    origin: Option<[f64; 2]>,
}

impl Particles {
    /// An emitter with the host's defaults.
    pub fn new() -> Particles {
        Particles::default()
    }

    /// A celebratory burst of spinning paper from the top edge.
    pub fn confetti() -> Particles {
        Particles::new()
            .rate(24.0)
            .burst(90.0)
            .lifetime(3.2)
            .speed(120.0, 320.0)
            .angle(60.0, 120.0)
            .gravity(0.0, 260.0)
            .size(3.0, 6.0)
            .spin(-360.0, 360.0)
            .shape(Shape::Rect)
            .origin(0.5, 0.0)
            .colors([
                Color::hex("#f43f5e"),
                Color::hex("#f59e0b"),
                Color::hex("#22c55e"),
                Color::hex("#3b82f6"),
                Color::hex("#a855f7"),
                Color::WHITE,
            ])
    }

    /// Soft glowing dots drifting upwards.
    pub fn sparkles() -> Particles {
        Particles::new()
            .rate(18.0)
            .lifetime(1.6)
            .speed(10.0, 40.0)
            .angle(250.0, 290.0)
            .gravity(0.0, -20.0)
            .size(1.0, 3.0)
            .origin(0.5, 0.5)
            .colors([Color::WHITE, Color::hex("#fde68a")])
    }

    /// Particles per second while active.
    pub fn rate(mut self, per_second: f64) -> Particles {
        self.rate = Some(per_second);
        self
    }

    /// Particles released at once when the emitter becomes active.
    pub fn burst(mut self, count: f64) -> Particles {
        self.burst = Some(count);
        self
    }

    /// Seconds a particle lives.
    pub fn lifetime(mut self, seconds: f64) -> Particles {
        self.lifetime = Some(seconds);
        self
    }

    /// Initial speed range in logical pixels per second.
    pub fn speed(mut self, min: f64, max: f64) -> Particles {
        self.speed = Some([min, max]);
        self
    }

    /// Emission direction range in degrees (0 = right, 90 = down).
    pub fn angle(mut self, min: f64, max: f64) -> Particles {
        self.angle = Some([min, max]);
        self
    }

    /// Constant acceleration `(x, y)` in logical pixels per second squared.
    pub fn gravity(mut self, x: f64, y: f64) -> Particles {
        self.gravity = Some([x, y]);
        self
    }

    /// Radius range in logical pixels.
    pub fn size(mut self, min: f64, max: f64) -> Particles {
        self.size = Some([min, max]);
        self
    }

    /// Colours picked at random per particle.
    pub fn colors(mut self, colors: impl IntoIterator<Item = Color>) -> Particles {
        self.colors = colors.into_iter().collect();
        self
    }

    /// Whether particles fade out over their lifetime.
    pub fn fade(mut self, fade: bool) -> Particles {
        self.fade = Some(fade);
        self
    }

    /// Rotation speed range in degrees per second (rectangles).
    pub fn spin(mut self, min: f64, max: f64) -> Particles {
        self.spin = Some([min, max]);
        self
    }

    /// Particle shape.
    pub fn shape(mut self, shape: Shape) -> Particles {
        self.shape = Some(shape);
        self
    }

    /// Emission point in the element's unit box (0,0 top left; 1,1 bottom
    /// right).
    pub fn origin(mut self, x: f64, y: f64) -> Particles {
        self.origin = Some([x, y]);
        self
    }

    pub(crate) fn encode(&self, out: &mut Vec<u8>) {
        let pairs = [
            ("speed", self.speed),
            ("angle", self.angle),
            ("gravity", self.gravity),
            ("size", self.size),
            ("spin", self.spin),
            ("origin", self.origin),
        ];
        let numbers = [
            ("rate", self.rate),
            ("burst", self.burst),
            ("lifetime", self.lifetime),
        ];
        let count = numbers.iter().filter(|(_, value)| value.is_some()).count()
            + pairs.iter().filter(|(_, value)| value.is_some()).count()
            + usize::from(!self.colors.is_empty())
            + usize::from(self.fade.is_some())
            + usize::from(self.shape.is_some());
        write_object_header(out, count);
        for (key, value) in numbers {
            if let Some(value) = value {
                write_key(out, key);
                write_number(out, value);
            }
        }
        for (key, value) in pairs {
            if let Some([first, second]) = value {
                write_key(out, key);
                write_array_header(out, 2);
                write_number(out, first);
                write_number(out, second);
            }
        }
        if !self.colors.is_empty() {
            write_key(out, "colors");
            write_array_header(out, self.colors.len());
            for color in &self.colors {
                write_string(out, &color.to_hex());
            }
        }
        if let Some(fade) = self.fade {
            write_key(out, "fade");
            write_bool(out, fade);
        }
        if let Some(shape) = self.shape {
            write_key(out, "shape");
            write_string(
                out,
                match shape {
                    Shape::Circle => "circle",
                    Shape::Rect => "rect",
                },
            );
        }
    }
}
