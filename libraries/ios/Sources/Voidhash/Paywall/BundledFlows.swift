import Foundation
import VoidhashCore

/// A flow the app ships in its bundle for a location, verified and ready to present: the last
/// resort of a presentation that has no answer for its location.
struct BundledFlow: Sendable, Equatable {
    /// The answer the flow stands for: the location, showing, paywall and release its events and
    /// purchases name, and its package. It never carries an exposure token.
    let answer: SdkResolvedPaywall
    /// The package's bytes, which hash to the SHA-256 the answer names.
    let package: Data

    init(answer: SdkResolvedPaywall, package: Data) {
        self.answer = answer
        self.package = package
    }
}

/// The flows an app ships in its bundle, so a location shows a flow on a first launch without a
/// connection, or during an outage, when the device has no answer for it yet.
///
/// They live in a folder named `VoidhashFlows` in the app's main bundle (a folder reference in
/// Xcode, so the files keep their names), with two files per location:
///
/// - `<location>.json`: the location's answer, as the resolve API returns it (`location`,
///   `showing` with its `paywallRelease` and `flowPackage`), and `interfaceRevision`, the revision
///   of the location's interface it was taken for (0 when absent). An exposure token and a list of
///   withdrawn packages in it are ignored. `notAfter`, an ISO 8601 timestamp, keeps a flow from
///   being shown after it.
/// - `<location>.vhfp`: the flow package that answer names, whose SHA-256 must match it.
///
/// A bundled flow is used only when the device has no answer for the location, cached or fresh,
/// and cannot get one; never when Voidhash answered that the location shows nothing, however long
/// ago; never when its revision is not the one the app presents; never when its package is
/// withdrawn, which any answer since may have said, or is one the renderer cannot read. Nothing is
/// read until a presentation needs it.
struct BundledFlows: Sendable {
    /// The folder's name in the main bundle.
    static let directoryName = "VoidhashFlows"

    /// The folder; `nil` when the app ships none.
    let directory: URL?

    /// The app's `VoidhashFlows` folder.
    static func main() -> BundledFlows {
        return BundledFlows(
            directory: Bundle.main.url(forResource: directoryName, withExtension: nil))
    }

    /// The largest answer file read; a real one is a few kilobytes.
    static let maxManifestBytes = 256 * 1024

    /// The verified flow bundled for `location` at interface `revision`, unless it is past its
    /// `notAfter` at `now`; `nil`, with a warning for a file that is there but unusable, when
    /// there is none to show.
    func flow(location: String, revision: Int, now: Date, warn: VoidhashWarningHandler)
        -> BundledFlow?
    {
        // A slug names a file in the folder, and nothing outside it.
        guard let directory, !location.isEmpty, !location.hasPrefix("."),
            location.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber || "-_.".contains($0)) })
        else {
            return nil
        }
        let manifestFile = directory.appendingPathComponent("\(location).json")
        guard let manifestSize = (try? manifestFile.resourceValues(forKeys: [.fileSizeKey]))?.fileSize
        else {
            return nil
        }
        func skip(_ reason: String) -> BundledFlow? {
            warn("The flow bundled for \"\(location)\" is not shown: \(reason)")
            return nil
        }
        guard manifestSize <= Self.maxManifestBytes,
            let manifest = try? Data(contentsOf: manifestFile)
        else {
            return skip("\(location).json is larger than an answer may be")
        }
        guard var object = (try? JSONSerialization.jsonObject(with: manifest)) as? [String: Any]
        else {
            return skip("\(location).json is not a JSON object")
        }
        guard let bundledRevision = Self.wholeNumber(object["interfaceRevision"], absent: 0) else {
            return skip("its interfaceRevision is not a whole number")
        }
        guard bundledRevision == revision else {
            return skip(
                "it was taken for revision \(bundledRevision) of the location's interface, and the app presents revision \(revision)"
            )
        }
        if let value = object["notAfter"] {
            guard let text = value as? String, let notAfter = Self.timestamp(text) else {
                return skip("its notAfter is not a timestamp such as 2026-12-31T00:00:00Z")
            }
            guard now <= notAfter else {
                return skip("it is past its notAfter")
            }
        }
        // Its exposure was counted, if ever, where the answer was taken; the withdrawn packages
        // that count are those the device has heard of.
        object["withdrawnPackages"] = nil
        if var showing = object["showing"] as? [String: Any] {
            showing["exposureToken"] = nil
            object["showing"] = showing
        }
        guard let cleaned = try? JSONSerialization.data(withJSONObject: object),
            let answer = try? JSONDecoder().decode(SdkResolvedPaywall.self, from: cleaned)
        else {
            return skip("\(location).json is not a resolve answer")
        }
        guard answer.location.slug == location else {
            return skip("\(location).json is the answer for \"\(answer.location.slug)\"")
        }
        guard let flowPackage = answer.showing.paywallRelease?.flowPackage else {
            return skip("its answer names no flow package")
        }
        let file = directory.appendingPathComponent("\(location).vhfp")
        guard
            let size = (try? file.resourceValues(forKeys: [.fileSizeKey]))?.fileSize,
            size <= FlowDownload.maxPackageBytes,
            let package = try? Data(contentsOf: file)
        else {
            return skip("\(location).vhfp is missing or larger than a flow package may be")
        }
        guard FlowPackageStore.sha256(package) == flowPackage.sha256.lowercased() else {
            return skip("\(location).vhfp does not match the SHA-256 its answer names")
        }
        return BundledFlow(answer: answer, package: package)
    }

    /// A JSON value that is a whole number from 0 up, as Android reads it too: `absent` when
    /// there is none, `nil` for a string, a boolean, a fraction or anything else.
    static func wholeNumber(_ value: Any?, absent: Int) -> Int? {
        guard let value else {
            return absent
        }
        guard let number = value as? NSNumber,
            CFGetTypeID(number) != CFBooleanGetTypeID()
        else {
            return nil
        }
        let double = number.doubleValue
        guard double >= 0, double <= Double(Int32.max), double.rounded() == double else {
            return nil
        }
        return Int(double)
    }

    /// An ISO 8601 timestamp with a time zone, with or without fractional seconds, as `notAfter`
    /// is written.
    static func timestamp(_ text: String) -> Date? {
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return plain.date(from: text) ?? fractional.date(from: text)
    }
}
