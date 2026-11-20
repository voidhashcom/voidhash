import CoreGraphics
import CoreText
import Foundation

/// The fonts one flow view sets text in, registered from memory and resolved by family and
/// weight here. Nothing is registered with the system, so the app's own fonts and other views
/// are unaffected.
package final class FontRegistry {
    /// The family text without a `fontFamily` uses.
    package static let defaultFamily = "Inter"

    private struct Face {
        let descriptor: CTFontDescriptor
        /// CSS weight of the face.
        let weight: Int
        let italic: Bool
        /// The face has a `wght` axis, which is set to the weight asked for.
        let variableWeight: Bool
    }

    private struct FontKey: Hashable {
        let family: String
        let weight: Int
        let italic: Bool
        let size: UInt32
    }

    private var families: [String: [Face]] = [:]
    private var fonts: [FontKey: CTFont] = [:]

    package init() {}

    /// Registers a TrueType or OpenType file (or collection) under `family`; `weight` overrides
    /// the weight the file declares. Returns whether the file held a font.
    @discardableResult
    package func register(family: String, data: Data, weight: Int? = nil) -> Bool {
        guard
            let descriptors = CTFontManagerCreateFontDescriptorsFromData(data as CFData)
                as? [CTFontDescriptor],
            !descriptors.isEmpty
        else {
            return false
        }
        let faces = descriptors.map { descriptor in
            let font = CTFontCreateWithFontDescriptor(descriptor, 12, nil)
            let traits = CTFontGetSymbolicTraits(font)
            let axes = (CTFontCopyVariationAxes(font) as? [[CFString: Any]]) ?? []
            let wght = 0x7767_6874  // 'wght'
            let variable = axes.contains { ($0[kCTFontVariationAxisIdentifierKey] as? Int) == wght }
            return Face(
                descriptor: descriptor,
                weight: weight ?? Self.declaredWeight(of: font),
                italic: traits.contains(.traitItalic),
                variableWeight: variable)
        }
        families[family, default: []].append(contentsOf: faces)
        fonts.removeAll()
        return true
    }

    /// Whether `family` has a font registered.
    package func contains(family: String) -> Bool {
        return families[family] != nil
    }

    /// The font for text naming `family` (empty or unregistered: the default family) at
    /// `weight` and `size`. A weight with no face resolves by CSS font matching; italic without
    /// an italic face is slanted.
    package func font(family: String, weight: Int, italic: Bool, size: CGFloat) -> CTFont {
        let resolved = families[family] != nil ? family : Self.defaultFamily
        let key = FontKey(
            family: resolved, weight: weight, italic: italic, size: Float(size).bitPattern)
        if let font = fonts[key] {
            return font
        }
        let font = makeFont(family: resolved, weight: weight, italic: italic, size: size)
        if fonts.count > 256 {
            fonts.removeAll()
        }
        fonts[key] = font
        return font
    }

    private func makeFont(family: String, weight: Int, italic: Bool, size: CGFloat) -> CTFont {
        guard let faces = families[family], !faces.isEmpty else {
            // No default font registered: the system's, so text still shows.
            return CTFontCreateUIFontForLanguage(.system, size, nil)
                ?? CTFontCreateWithName("Helvetica" as CFString, size, nil)
        }
        let styled = faces.filter { $0.italic == italic }
        let face = Self.match(weight: weight, in: styled.isEmpty ? faces : styled)
        var descriptor = face.descriptor
        if face.variableWeight {
            descriptor = CTFontDescriptorCreateCopyWithVariation(
                descriptor, 0x7767_6874 as CFNumber, CGFloat(min(max(weight, 1), 1000)))
        }
        if italic && !face.italic {
            // About 12°, the slant browsers synthesize.
            var slant = CGAffineTransform(a: 1, b: 0, c: 0.21, d: 1, tx: 0, ty: 0)
            return CTFontCreateWithFontDescriptor(descriptor, size, &slant)
        }
        return CTFontCreateWithFontDescriptor(descriptor, size, nil)
    }

    /// CSS font matching by weight (CSS Fonts 4, "font-weight").
    private static func match(weight: Int, in faces: [Face]) -> Face {
        if let exact = faces.first(where: { $0.weight == weight || $0.variableWeight }) {
            return exact
        }
        let lighter = faces.filter { $0.weight < weight }.sorted { $0.weight > $1.weight }
        let heavier = faces.filter { $0.weight > weight }.sorted { $0.weight < $1.weight }
        let order: [Face]
        if weight >= 400 && weight <= 500 {
            let upTo500 = heavier.filter { $0.weight <= 500 }
            let past500 = heavier.filter { $0.weight > 500 }
            order = upTo500 + lighter + past500
        } else if weight < 400 {
            order = lighter + heavier
        } else {
            order = heavier + lighter
        }
        return order.first ?? faces[0]
    }

    /// The weight class a font declares in its OS/2 table, 400 when it declares none.
    private static func declaredWeight(of font: CTFont) -> Int {
        let os2 = 0x4F53_2F32  // 'OS/2'
        guard
            let table = CTFontCopyTable(font, CTFontTableTag(os2), []) as Data?,
            table.count >= 6
        else {
            return 400
        }
        let weight = Int(table[table.startIndex + 4]) << 8 | Int(table[table.startIndex + 5])
        return (1...1000).contains(weight) ? weight : 400
    }
}
