import Foundation

#if os(iOS)
    import UIKit
#endif

/// How the keyboard is set up for a text input, in the runtime's vocabulary (flow inputs,
/// "What the engine does and what the platform does"): the engine surface sends it in its
/// `textInput` message, the views surface as a field's props, with the same values and the same
/// meaning.
package struct TextInputConfiguration: Equatable, Sendable {
    package var keyboard = "text"
    package var returnKey = "default"
    package var secure = false
    package var multiline = false
    package var capitalization = "sentences"
    package var autocorrect = true
    package var autofill = "none"

    package init() {}

    /// A `textInput` message's `config`; absent or mistyped keys keep their defaults.
    package init(_ object: [String: Any]) {
        keyboard = object["keyboard"] as? String ?? keyboard
        returnKey = object["returnKey"] as? String ?? returnKey
        secure = object["secure"] as? Bool ?? secure
        multiline = object["multiline"] as? Bool ?? multiline
        capitalization = object["capitalization"] as? String ?? capitalization
        autocorrect = object["autocorrect"] as? Bool ?? autocorrect
        autofill = object["autofill"] as? String ?? autofill
    }

    /// What the return key asks of the focused input. A key labelled `default` asks for a line
    /// break, which only a multiline input inserts.
    package var returnAction: String {
        return returnKey == "default" ? "newline" : returnKey
    }
}

#if os(iOS)
    /// A text input object whose keyboard traits a ``TextInputConfiguration`` sets: UIKit's
    /// own fields, or a custom keyboard client.
    @MainActor
    package protocol TextInputTraitsTarget: AnyObject {
        var keyboardType: UIKeyboardType { get set }
        var returnKeyType: UIReturnKeyType { get set }
        var autocapitalizationType: UITextAutocapitalizationType { get set }
        var autocorrectionType: UITextAutocorrectionType { get set }
        var spellCheckingType: UITextSpellCheckingType { get set }
        var smartQuotesType: UITextSmartQuotesType { get set }
        var smartDashesType: UITextSmartDashesType { get set }
        var isSecureTextEntry: Bool { get set }
        var textContentType: UITextContentType! { get set }
    }

    extension TextInputConfiguration {
        /// Gives `target` the keyboard this configuration describes. UIKit reads the traits when
        /// the target takes the keyboard, so they are set before it does, or followed by
        /// `reloadInputViews()` while it has it.
        @MainActor
        package func apply(to target: some TextInputTraitsTarget) {
            switch keyboard {
            case "email": target.keyboardType = .emailAddress
            case "number": target.keyboardType = .numberPad
            case "decimal": target.keyboardType = .decimalPad
            case "phone": target.keyboardType = .phonePad
            case "url": target.keyboardType = .URL
            default: target.keyboardType = .default
            }
            switch returnKey {
            case "next": target.returnKeyType = .next
            case "done": target.returnKeyType = .done
            case "go": target.returnKeyType = .go
            case "search": target.returnKeyType = .search
            case "send": target.returnKeyType = .send
            default: target.returnKeyType = .default
            }
            switch capitalization {
            case "none": target.autocapitalizationType = .none
            case "words": target.autocapitalizationType = .words
            case "characters": target.autocapitalizationType = .allCharacters
            default: target.autocapitalizationType = .sentences
            }
            target.autocorrectionType = autocorrect ? .default : .no
            target.spellCheckingType = autocorrect ? .default : .no
            let prose = autocorrect && keyboard == "text"
            target.smartQuotesType = prose ? .default : .no
            target.smartDashesType = prose ? .default : .no
            target.isSecureTextEntry = secure
            switch autofill {
            case "name": target.textContentType = .name
            case "givenName": target.textContentType = .givenName
            case "familyName": target.textContentType = .familyName
            case "email": target.textContentType = .emailAddress
            case "phone": target.textContentType = .telephoneNumber
            case "username": target.textContentType = .username
            case "newPassword": target.textContentType = .newPassword
            case "password": target.textContentType = .password
            case "oneTimeCode": target.textContentType = .oneTimeCode
            case "postalCode": target.textContentType = .postalCode
            case "country": target.textContentType = .countryName
            case "organization": target.textContentType = .organizationName
            default: target.textContentType = nil
            }
        }
    }
#endif
