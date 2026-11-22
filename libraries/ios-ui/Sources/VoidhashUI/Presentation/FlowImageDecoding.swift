#if os(iOS)
    import ImageIO
    import UIKit

    /// Decodes the images a flow shows, never larger than a phone can hold for them.
    enum FlowImageDecoding {
        /// Largest side, in pixels, an image is decoded at; a larger one is scaled down to it as
        /// it decodes. Android's renderer decodes at the same (`MAX_IMAGE_SIDE`).
        static let maxImageSide = 4096

        /// Most pixels an image's source may declare. ImageIO decodes the whole source of a PNG
        /// or a JPEG before it scales it down, at four bytes a pixel, and a small file can
        /// declare billions: one larger than twice ``maxImageSide`` on each side (256 MB decoded)
        /// is refused rather than decoded.
        static let maxSourcePixels = (2 * maxImageSide) * (2 * maxImageSide)

        /// The image `data` holds, decoded now and at most ``maxImageSide`` on a side, turned as
        /// its orientation says; `nil` when it is no image ImageIO reads, or declares more than
        /// ``maxSourcePixels``.
        static func image(from data: Data) -> UIImage? {
            guard
                let source = CGImageSourceCreateWithData(
                    data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
                CGImageSourceGetCount(source) > 0,
                let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil)
                    as? [CFString: Any],
                let width = properties[kCGImagePropertyPixelWidth] as? Int,
                let height = properties[kCGImagePropertyPixelHeight] as? Int,
                width > 0, height > 0, width <= maxSourcePixels / height
            else {
                return nil
            }
            let options: [CFString: Any] = [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceThumbnailMaxPixelSize: min(max(width, height), maxImageSide),
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceShouldCacheImmediately: true,
            ]
            return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary).map {
                UIImage(cgImage: $0)
            }
        }
    }
#endif
