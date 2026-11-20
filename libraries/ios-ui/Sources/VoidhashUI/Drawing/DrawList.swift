import CoreGraphics
import CoreText
import Foundation

/// Draws a canvas draw list (guest ABI 1, "Canvases and draw lists") with Core Graphics.
///
/// The context is in the canvas's logical pixels with the origin at its top-left corner and y
/// pointing down. Opacity (`op 12`) multiplies into colours and images and is saved and restored
/// with the graphics state, as the engine draws it. The core validated the list; a truncated
/// command ends it, and saves it leaves open are restored after it.
package enum DrawList {
    package static func draw(
        _ list: [UInt8], in context: CGContext, images: (Int) -> CGImage?, fonts: FontRegistry
    ) {
        var reader = ByteReader(list[...])
        var alpha: CGFloat = 1
        var saved: [CGFloat] = []
        context.saveGState()
        defer {
            for _ in saved {
                context.restoreGState()
            }
            context.restoreGState()
        }
        while let code = reader.u8() {
            switch code {
            case 1:
                guard let x = reader.f32(), let y = reader.f32(), let w = reader.f32(),
                    let h = reader.f32(), let color = reader.u32()
                else { return }
                context.setFillColor(Self.color(color, alpha))
                context.fill(CGRect(x: CGFloat(x), y: CGFloat(y), width: CGFloat(w), height: CGFloat(h)))
            case 2:
                guard let x = reader.f32(), let y = reader.f32(), let w = reader.f32(),
                    let h = reader.f32(), let radius = reader.f32(), let color = reader.u32()
                else { return }
                let rect = CGRect(x: CGFloat(x), y: CGFloat(y), width: CGFloat(w), height: CGFloat(h))
                    .standardized
                let corner = min(max(0, CGFloat(radius)), rect.width / 2, rect.height / 2)
                context.setFillColor(Self.color(color, alpha))
                context.addPath(
                    CGPath(roundedRect: rect, cornerWidth: corner, cornerHeight: corner, transform: nil))
                context.fillPath()
            case 3:
                guard let cx = reader.f32(), let cy = reader.f32(), let r = reader.f32(),
                    let color = reader.u32()
                else { return }
                let radius = max(0, CGFloat(r))
                context.setFillColor(Self.color(color, alpha))
                context.fillEllipse(
                    in: CGRect(
                        x: CGFloat(cx) - radius, y: CGFloat(cy) - radius, width: radius * 2,
                        height: radius * 2))
            case 4:
                guard let x1 = reader.f32(), let y1 = reader.f32(), let x2 = reader.f32(),
                    let y2 = reader.f32(), let width = reader.f32(), let color = reader.u32()
                else { return }
                context.setStrokeColor(Self.color(color, alpha))
                context.setLineWidth(CGFloat(width))
                context.setLineCap(.butt)
                context.strokeLineSegments(between: [
                    CGPoint(x: CGFloat(x1), y: CGFloat(y1)), CGPoint(x: CGFloat(x2), y: CGFloat(y2)),
                ])
            case 5:
                guard let index = reader.u16(), let x = reader.f32(), let y = reader.f32(),
                    let w = reader.f32(), let h = reader.f32(), let opacity = reader.f32()
                else { return }
                if let image = images(Int(index)) {
                    Self.drawImage(
                        image,
                        in: CGRect(x: CGFloat(x), y: CGFloat(y), width: CGFloat(w), height: CGFloat(h)),
                        alpha: CGFloat(opacity) * alpha, context: context)
                }
            case 6:
                guard let x = reader.f32(), let y = reader.f32(), let size = reader.f32(),
                    let color = reader.u32(), let length = reader.u16(),
                    let bytes = reader.take(Int(length))
                else { return }
                Self.drawText(
                    String(decoding: bytes, as: UTF8.self), at: CGPoint(x: CGFloat(x), y: CGFloat(y)),
                    size: CGFloat(size), color: Self.color(color, alpha), fonts: fonts,
                    context: context)
            case 7:
                context.saveGState()
                saved.append(alpha)
            case 8:
                if let previous = saved.popLast() {
                    context.restoreGState()
                    alpha = previous
                }
            case 9:
                guard let x = reader.f32(), let y = reader.f32() else { return }
                context.translateBy(x: CGFloat(x), y: CGFloat(y))
            case 10:
                guard let radians = reader.f32() else { return }
                context.rotate(by: CGFloat(radians))
            case 11:
                guard let sx = reader.f32(), let sy = reader.f32() else { return }
                context.scaleBy(x: CGFloat(sx), y: CGFloat(sy))
            case 12:
                guard let factor = reader.f32() else { return }
                alpha *= min(max(CGFloat(factor), 0), 1)
            case 13:
                guard let index = reader.u16(), let count = reader.u32(),
                    Int(count) <= reader.remaining / 20
                else { return }
                let image = images(Int(index))
                for _ in 0..<count {
                    guard let x = reader.f32(), let y = reader.f32(), let size = reader.f32(),
                        let rotation = reader.f32(), let opacity = reader.f32()
                    else { return }
                    guard let image else { continue }
                    let side = CGFloat(size)
                    context.saveGState()
                    context.translateBy(x: CGFloat(x), y: CGFloat(y))
                    context.rotate(by: CGFloat(rotation))
                    Self.drawImage(
                        image, in: CGRect(x: -side / 2, y: -side / 2, width: side, height: side),
                        alpha: CGFloat(opacity) * alpha, context: context)
                    context.restoreGState()
                }
            default:
                // Not an operation of ABI 1: nothing after it can be read.
                return
            }
        }
    }

    /// `0xRRGGBBAA` with straight alpha, its alpha multiplied by `alpha`.
    package static func color(_ rgba: UInt32, _ alpha: CGFloat = 1) -> CGColor {
        let channel = { (shift: UInt32) in CGFloat((rgba >> shift) & 0xFF) / 255 }
        return CGColor(
            srgbRed: channel(24), green: channel(16), blue: channel(8),
            alpha: channel(0) * min(max(alpha, 0), 1))
    }

    /// Draws `image` upright into `rect` of a y-down context.
    private static func drawImage(
        _ image: CGImage, in rect: CGRect, alpha: CGFloat, context: CGContext
    ) {
        guard alpha > 0 else {
            return
        }
        context.saveGState()
        context.setAlpha(min(alpha, 1))
        context.translateBy(x: rect.minX, y: rect.maxY)
        context.scaleBy(x: 1, y: -1)
        context.interpolationQuality = .high
        context.draw(image, in: CGRect(origin: .zero, size: rect.size))
        context.restoreGState()
    }

    /// Draws one line of text in the default font with its baseline at `point`.
    private static func drawText(
        _ text: String, at point: CGPoint, size: CGFloat, color: CGColor, fonts: FontRegistry,
        context: CGContext
    ) {
        guard size > 0, !text.isEmpty else {
            return
        }
        let font = fonts.font(family: "", weight: 400, italic: false, size: size)
        let line = CTLineCreateWithAttributedString(
            NSAttributedString(
                string: text,
                attributes: [
                    NSAttributedString.Key(kCTFontAttributeName as String): font,
                    NSAttributedString.Key(kCTForegroundColorFromContextAttributeName as String):
                        true,
                ]))
        context.saveGState()
        context.setFillColor(color)
        context.textMatrix = .identity
        context.translateBy(x: point.x, y: point.y)
        context.scaleBy(x: 1, y: -1)
        context.textPosition = .zero
        CTLineDraw(line, context)
        context.restoreGState()
    }
}
