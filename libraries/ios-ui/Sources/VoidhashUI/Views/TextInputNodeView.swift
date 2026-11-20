#if os(iOS)
    import UIKit

    /// What a text field holds, as the core hears it: the whole text, the selection in UTF-16
    /// code units, and whether the input method composes (holds marked text) in it. The text
    /// is the end user's, so no description carries it.
    struct TextFieldState: Equatable, CustomStringConvertible, CustomDebugStringConvertible,
        CustomReflectable
    {
        var text: String
        var selectionBase: Int
        var selectionExtent: Int
        var composing: Bool

        var description: String {
            return "text field state (selection \(selectionBase)–\(selectionExtent))"
        }

        var debugDescription: String {
            return description
        }

        var customMirror: Mirror {
            return Mirror(
                self,
                children: [
                    "selectionBase": selectionBase, "selectionExtent": selectionExtent,
                    "composing": composing,
                ])
        }
    }

    /// An edit the platform named: it replaced `replaced` (UTF-16 code units of the text
    /// before it) with `insertedLength` UTF-16 code units.
    struct TextEdit: Equatable {
        var replaced: Range<Int>
        var insertedLength: Int
    }

    /// A `textInput` view (views protocol, "Text input"): the platform's own field, which owns
    /// its text, caret, selection, composition, autofill and accessibility. A `UITextField`, or
    /// a `UITextView` when `multiline` (a secure field stays a `UITextField`, the only one UIKit
    /// masks). The view draws the box (background, border, radii) and keeps the field over it,
    /// at `textInsets`.
    ///
    /// It reports every change of the field to the core with the field's revision rule:
    /// the revision `text_changed` returns is kept, and a `TEXT_SET` applies only on the
    /// revision it was based on. A text it sets itself is never reported back.
    final class TextInputNodeView: NodeView {
        private(set) var field: any NativeTextField
        /// The revision the core last gave the field (views protocol, "Revisions").
        private(set) var revision: UInt64 = 0
        /// What the core last knew the field to hold: reported by the field, or set by the core.
        private var known: TextFieldState
        /// The edit the field named last (its delegate's range-replacement callback, or one of
        /// the `UITextInput` edits the field intercepts), until the change it makes is reported.
        private var namedEdit: TextEdit?
        /// A `TEXT_SET` is being applied: what the field does meanwhile is not the end user's.
        private var applyingSet = false
        /// The field is being made first responder by the host, not by the end user.
        private var focusingByCommand = false
        /// A `TEXT_FOCUS` waiting for the field to be in a window.
        private(set) var wantsFocus = false
        private(set) var configuration = TextInputConfiguration()

        /// The field taking the keyboard from another of these fields right now, so the one
        /// giving it up does not report a blur: the focus moves straight between them.
        private static weak var takingFocus: UIView?

        required init(id: Int32, kind: NodeKind, host: NodeHost?) {
            let field = SingleLineTextField()
            self.field = field
            known = TextFieldState(text: "", selectionBase: 0, selectionExtent: 0, composing: false)
            super.init(id: id, kind: kind, host: host)
            install(field)
        }

        // MARK: - Props

        /// The keyboard set-up's keys; they also choose the kind of field.
        private static let keyboardKeys: Set<String> = [
            "keyboard", "returnKey", "capitalization", "autocorrect", "autofill",
            "secureTextEntry", "multiline",
        ]

        /// The props the field's text and placeholder are styled from.
        private static let styleKeys: Set<String> = [
            "fontFamily", "fontSize", "fontWeight", "italic", "lineHeight", "letterSpacing",
            "textAlign", "color", "decoration", "textStroke", "textShadow", "textInsets",
            "placeholder", "placeholderColor", "caretColor", "selectionColor",
        ]

        override func refreshContent(_ change: Change) {
            if change.touches(Self.keyboardKeys, orSize: false) {
                applyKeyboard()
            }
            if change.touches(Self.styleKeys) {
                field.applyStyle(style)
            }
            if change.touches(["disabled", "readOnly"], orSize: false) {
                field.isDisabled = props["disabled"]?.bool == true
                if isDisabled, field.isFirstResponder {
                    // A disabled field takes no focus; the core moves the keyboard on.
                    _ = field.resignFirstResponder()
                }
            }
            field.frame = CGRect(origin: .zero, size: nodeFrame.size)
        }

        var isDisabled: Bool {
            return props["disabled"]?.bool == true
        }

        var isReadOnly: Bool {
            return props["readOnly"]?.bool == true
        }

        var maxLength: Int? {
            guard let value = props["maxLength"]?.number, value >= 0 else {
                return nil
            }
            return Int(min(value, Double(Int32.max)))
        }

        /// The keyboard set-up from the props, with the runtime's defaults for absent keys.
        private var configurationFromProps: TextInputConfiguration {
            var configuration = TextInputConfiguration()
            configuration.keyboard = props["keyboard"]?.string ?? configuration.keyboard
            configuration.returnKey = props["returnKey"]?.string ?? configuration.returnKey
            configuration.capitalization =
                props["capitalization"]?.string ?? configuration.capitalization
            configuration.autocorrect = props["autocorrect"]?.bool ?? configuration.autocorrect
            configuration.autofill = props["autofill"]?.string ?? configuration.autofill
            configuration.secure = props["secureTextEntry"]?.bool == true
            configuration.multiline = props["multiline"]?.bool == true
            return configuration
        }

        /// Gives the field its keyboard set-up, replacing the field when it turns multiline or
        /// back. UIKit reads the traits when the field takes the keyboard, so they are in place
        /// before it can; a field that has it reloads its keyboard in place.
        private func applyKeyboard() {
            let next = configurationFromProps
            let changed = next != configuration
            let turnsSecure = next.secure && !configuration.secure
            configuration = next
            let wantsTextView = next.multiline && !next.secure
            if wantsTextView != (field is MultilineTextView) {
                replaceField(with: wantsTextView ? MultilineTextView() : SingleLineTextField())
                return
            }
            next.apply(to: field)
            if changed, field.isFirstResponder {
                // Set-up arriving late (views protocol, "Text input"): the field already has
                // the keyboard, and keeps it and its text.
                field.reloadInputViews()
                if turnsSecure {
                    keepTextTurningSecure()
                }
            }
        }

        /// A field that turns secure while it has the keyboard would clear its text at the next
        /// keystroke, as UIKit does when typing starts in a secure field. A backspace takes
        /// that clearing now, and the text and selection are put back; the core hears nothing,
        /// as what the field holds does not change.
        private func keepTextTurningSecure() {
            let state = field.currentState
            guard !state.text.isEmpty else {
                return
            }
            applyingSet = true
            defer {
                applyingSet = false
                namedEdit = nil
            }
            field.deleteBackward()
            if let all = field.textRange(from: field.beginningOfDocument, to: field.endOfDocument)
            {
                field.replace(all, withText: state.text)
            }
            field.select(state.selectionBase, state.selectionExtent)
        }

        private func install(_ field: any NativeTextField) {
            field.owner = self
            field.frame = CGRect(origin: .zero, size: nodeFrame.size)
            addSubview(field)
        }

        /// Swaps in `next`, with the same text, selection and keyboard, without reporting:
        /// what the field holds does not change.
        private func replaceField(with next: any NativeTextField) {
            let old = field
            let state = old.currentState
            let hadKeyboard = old.isFirstResponder
            field = next
            next.owner = self
            next.isDisabled = isDisabled
            next.applyStyle(style)
            configuration.apply(to: next)
            next.frame = old.frame
            old.superview?.insertSubview(next, aboveSubview: old)
            applyingSet = true
            next.fieldText = state.text
            if hadKeyboard {
                focusingByCommand = true
                _ = next.becomeFirstResponder()
                focusingByCommand = false
            }
            old.owner = nil
            old.removeFromSuperview()
            next.select(state.selectionBase, state.selectionExtent)
            applyingSet = false
        }

        /// The text style of the field and its placeholder.
        private var style: TextFieldStyle {
            let size = CGFloat(props["fontSize"]?.number ?? 14)
            let font: UIFont
            if let host {
                font = host.textSystem.fonts.font(
                    family: props["fontFamily"]?.string ?? "",
                    weight: Int(min(max(props["fontWeight"]?.number ?? 400, 1), 1000)),
                    italic: props["italic"]?.bool == true, size: size) as UIFont
            } else {
                font = UIFont.systemFont(ofSize: size)
            }
            let color = { (key: String, fallback: UInt32) -> UIColor in
                UIColor(
                    cgColor: DrawList.color(
                        self.props[key]?.number.map { UInt32(clamping: Int($0)) } ?? fallback))
            }
            let paragraph = NSMutableParagraphStyle()
            switch props["textAlign"]?.string {
            case "right": paragraph.alignment = .right
            case "center": paragraph.alignment = .center
            case "justify": paragraph.alignment = .justified
            default: paragraph.alignment = .left
            }
            let lineHeight = CGFloat(props["lineHeight"]?.number ?? Double(size) * 1.2)
            var text: [NSAttributedString.Key: Any] = [
                .font: font,
                .foregroundColor: color("color", 0xFF),
                .kern: CGFloat(props["letterSpacing"]?.number ?? 0),
            ]
            var placeholder = text
            placeholder[.foregroundColor] = color("placeholderColor", 0x3C3C_4399)
            if let decoration = props["decoration"] {
                let line = Self.underlineStyle(decoration["style"]?.string)
                let lineColor = decoration["color"]?.number.map {
                    UIColor(cgColor: DrawList.color(UInt32(clamping: Int($0))))
                }
                if decoration["underline"]?.bool == true {
                    text[.underlineStyle] = line.rawValue
                    text[.underlineColor] = lineColor
                }
                if decoration["lineThrough"]?.bool == true {
                    text[.strikethroughStyle] = line.rawValue
                    text[.strikethroughColor] = lineColor
                }
            }
            if let stroke = props["textStroke"], let width = stroke["width"]?.number, width > 0,
                size > 0
            {
                // A percentage of the font size, centred on the glyph edge; negative also fills.
                text[.strokeWidth] = -CGFloat(width) * 2 / size * 100
                text[.strokeColor] = UIColor(
                    cgColor: DrawList.color(UInt32(clamping: Int(stroke["color"]?.number ?? 0xFF))))
            }
            if let shadow = props["textShadow"], let shadowColor = shadow["color"]?.number {
                let value = NSShadow()
                value.shadowColor = UIColor(cgColor: DrawList.color(UInt32(clamping: Int(shadowColor))))
                value.shadowOffset = CGSize(
                    width: shadow["x"]?.number ?? 0, height: shadow["y"]?.number ?? 0)
                value.shadowBlurRadius = CGFloat(shadow["blur"]?.number ?? 0)
                text[.shadow] = value
            }
            let insets = props["textInsets"]?.numbers ?? []
            return TextFieldStyle(
                text: text, placeholderAttributes: placeholder, paragraph: paragraph,
                lineHeight: lineHeight,
                placeholder: props["placeholder"]?.string,
                caretColor: color("caretColor", 0x007A_FFFF),
                insets: insets.count == 4
                    ? UIEdgeInsets(top: insets[0], left: insets[3], bottom: insets[2], right: insets[1])
                    : .zero)
        }

        private static func underlineStyle(_ style: String?) -> NSUnderlineStyle {
            switch style {
            case "double": return .double
            case "dashed": return [.single, .patternDash]
            case "dotted": return [.single, .patternDot]
            default: return .single
            }
        }

        // MARK: - Commands

        /// `TEXT_SET`: sets the text and selection when the field is still at `base`, and
        /// keeps the new revision; otherwise the field was edited since and the set is dropped.
        /// Returns whether it applied.
        @discardableResult
        func apply(_ set: TextSet) -> Bool {
            guard set.base == TextSet.anyRevision || set.base == revision else {
                return false
            }
            revision = set.revision
            namedEdit = nil
            let length = (set.text as NSString).length
            let next = TextFieldState(
                text: set.text, selectionBase: min(set.selectionBase, length),
                selectionExtent: min(set.selectionExtent, length), composing: false)
            known = next
            let current = field.currentState
            // What the field already holds stays untouched: an input method's composition,
            // the predictive bar's marked text, survives a set that changes nothing.
            if current.text == next.text, current.composing
                || (current.selectionBase, current.selectionExtent)
                    == (next.selectionBase, next.selectionExtent)
            {
                known.composing = current.composing
                return true
            }
            applyingSet = true
            if current.text != next.text {
                field.fieldText = next.text
            }
            field.select(next.selectionBase, next.selectionExtent)
            applyingSet = false
            field.textDidChangeShown()
            return true
        }

        /// `TEXT_FOCUS`: the field becomes first responder, straight from any other field so
        /// the keyboard stays up, or as soon as it is in a window.
        func focus() {
            wantsFocus = true
            takeFocusIfPossible()
        }

        /// A `TEXT_FOCUS` of another field replaced this one's before it could apply.
        func cancelFocusRequest() {
            wantsFocus = false
        }

        /// `TEXT_BLUR`: the field resigns when it has the keyboard.
        func blur() {
            wantsFocus = false
            if field.isFirstResponder {
                _ = field.resignFirstResponder()
            }
        }

        /// Called by the field when it moved to a window.
        fileprivate func takeFocusIfPossible() {
            guard wantsFocus, field.window != nil else {
                return
            }
            wantsFocus = false
            guard !field.isFirstResponder else {
                return
            }
            focusingByCommand = true
            _ = field.becomeFirstResponder()
            focusingByCommand = false
        }

        // MARK: - What the field reports

        /// The field's text, selection or composition may have changed: reports it unless it is
        /// what the core already knows, or the field is applying the core's own set.
        fileprivate func fieldChanged() {
            field.textDidChangeShown()
            guard !applyingSet, let host else {
                return
            }
            let state = field.currentState
            guard state != known else {
                return
            }
            // A named edit belongs to the next change of the text, and only when it leads from
            // the text the core knows to this one; a moved caret keeps it waiting.
            var edit: TextEdit?
            if state.text != known.text, let named = namedEdit {
                namedEdit = nil
                let before = (known.text as NSString).length
                let after = (state.text as NSString).length
                if named.replaced.upperBound <= before,
                    before - named.replaced.count + named.insertedLength == after
                {
                    edit = named
                }
            }
            known = state
            if let next = host.textChanged(self, state, edit: edit, byUser: !focusingByCommand) {
                revision = next
            }
        }

        /// The field is about to replace `range` (UTF-16 code units) with `text`; reported
        /// with the change it makes.
        fileprivate func willEdit(_ range: NSRange, inserting text: String) {
            guard range.location != NSNotFound else {
                namedEdit = nil
                return
            }
            namedEdit = TextEdit(
                replaced: range.location..<(range.location + range.length),
                insertedLength: (text as NSString).length)
        }

        /// Runs `becomeFirstResponder` of `field`, marked as taking the keyboard.
        fileprivate static func takingFocus(_ field: UIView, _ become: () -> Bool) -> Bool {
            let previous = takingFocus
            takingFocus = field
            defer { takingFocus = previous }
            return become()
        }

        fileprivate func editingBegan() {
            host?.textFocused(self)
        }

        fileprivate func editingEnded(_ field: UIView) {
            // Straight to another field: that one reports its focus, and the keyboard stays.
            if let taking = Self.takingFocus, taking !== field {
                return
            }
            host?.textBlurred(self)
        }

        /// Whether the field takes an edit of `range` (UTF-16) into `replacement`: not while
        /// read-only or disabled, nor typing into a full field at its caret (views protocol,
        /// `text_changed`: such an edit is refused whole). Any other edit past `maxLength` is
        /// the core's to cut, and composing text waits until the composition ends.
        fileprivate func allowsEdit(of range: NSRange, with replacement: String) -> Bool {
            guard !isReadOnly, !isDisabled else {
                return false
            }
            guard let maxLength, field.markedTextRange == nil, range.length == 0 else {
                return true
            }
            let text = field.fieldText
            guard text.count >= maxLength, !replacement.isEmpty else {
                return true
            }
            return (text as NSString).replacingCharacters(in: range, with: replacement).count
                <= maxLength
        }

        /// Whether the field takes `text` typed over its selection. The keyboard asks the
        /// field's delegate first; typing that reaches the field directly (a hardware key, an
        /// assistive technology) is held to the same rule here.
        fileprivate func allowsInsert(_ text: String) -> Bool {
            let state = field.currentState
            let start = min(state.selectionBase, state.selectionExtent)
            let range = NSRange(
                location: start, length: max(state.selectionBase, state.selectionExtent) - start)
            return allowsEdit(of: range, with: text)
        }

        /// The return key. Returns whether the field inserts it as a line break itself: only a
        /// multiline field whose key is labelled `default` does.
        fileprivate func returnKeyPressed() -> Bool {
            if field is MultilineTextView, configuration.returnKey == "default" {
                return true
            }
            host?.textAction(self, configuration.returnAction)
            return false
        }

        // MARK: - Hit-testing

        override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
            let hit = super.hitTest(point, with: event)
            guard hit === self else {
                return hit
            }
            // The field takes its own touches: taps, selection, the edit menu.
            return field.hitTest(convert(point, to: field), with: event) ?? field
        }

        // MARK: - Accessibility

        /// The field is the element, with UIKit's own text field traits and value.
        override var isAccessibilityElement: Bool {
            get { false }
            set {}
        }

        override var spokenText: String? {
            return props["accessibilityLabel"]?.string
        }

        /// The field's label: the author's, else the placeholder, as native fields read.
        var fieldLabel: String? {
            return props["accessibilityLabel"]?.string ?? props["placeholder"]?.string
        }

        // MARK: - Secure text in snapshots

        /// Runs `body`, which draws `view`'s layer tree into an image, with the text of every
        /// secure field in it hidden, so a snapshot the host takes for an effect never holds a
        /// password, nor the character a secure field shows while it is typed.
        static func withSecureTextHidden<T>(in view: UIView, _ body: () -> T) -> T {
            var hidden: [CALayer] = []
            var pending: [UIView] = [view]
            while let next = pending.popLast() {
                if let node = next as? TextInputNodeView, node.configuration.secure,
                    !node.field.layer.isHidden
                {
                    node.field.layer.isHidden = true
                    hidden.append(node.field.layer)
                    continue
                }
                pending.append(contentsOf: next.subviews)
            }
            defer {
                for layer in hidden {
                    layer.isHidden = false
                }
            }
            return body()
        }
    }

    /// The style a field's text and placeholder are drawn with.
    struct TextFieldStyle {
        var text: [NSAttributedString.Key: Any]
        var placeholderAttributes: [NSAttributedString.Key: Any]
        var paragraph: NSParagraphStyle
        var lineHeight: CGFloat
        var placeholder: String?
        var caretColor: UIColor
        /// Where the text box sits in the field.
        var insets: UIEdgeInsets
    }

    /// The native field of a ``TextInputNodeView``.
    @MainActor
    protocol NativeTextField: UIView, UITextInput, TextInputTraitsTarget {
        var owner: TextInputNodeView? { get set }
        /// The whole text, set without the field telling its owner.
        var fieldText: String { get set }
        var isDisabled: Bool { get set }
        func applyStyle(_ style: TextFieldStyle)
        /// The text shown changed; a field that draws its own placeholder updates it.
        func textDidChangeShown()
    }

    extension NativeTextField {
        /// The text and selection, in UTF-16 code units, and whether marked text is composed.
        var currentState: TextFieldState {
            let text = fieldText
            let length = (text as NSString).length
            guard let range = selectedTextRange else {
                return TextFieldState(
                    text: text, selectionBase: length, selectionExtent: length,
                    composing: markedTextRange != nil)
            }
            let clamp = { (value: Int) in min(max(value, 0), length) }
            return TextFieldState(
                text: text,
                selectionBase: clamp(offset(from: beginningOfDocument, to: range.start)),
                selectionExtent: clamp(offset(from: beginningOfDocument, to: range.end)),
                composing: markedTextRange != nil)
        }

        /// `range` in UTF-16 code units of the text.
        func utf16Range(_ range: UITextRange) -> NSRange {
            let start = offset(from: beginningOfDocument, to: range.start)
            return NSRange(location: start, length: offset(from: range.start, to: range.end))
        }

        /// What typing replaces: the marked text while composing, else the selection.
        var typingRange: NSRange {
            guard let range = markedTextRange ?? selectedTextRange else {
                return NSRange(location: NSNotFound, length: 0)
            }
            return utf16Range(range)
        }

        /// What a backspace deletes: the selection, else the character before the caret.
        var deletionRange: NSRange {
            let range = typingRange
            guard range.location != NSNotFound, range.length == 0 else {
                return range
            }
            guard range.location > 0 else {
                return NSRange(location: NSNotFound, length: 0)
            }
            return (fieldText as NSString).rangeOfComposedCharacterSequence(
                at: range.location - 1)
        }

        /// Selects from `base` to `extent` (UTF-16 code units, either order).
        func select(_ base: Int, _ extent: Int) {
            guard let start = position(from: beginningOfDocument, offset: min(base, extent)),
                let end = position(from: beginningOfDocument, offset: max(base, extent))
            else {
                return
            }
            selectedTextRange = textRange(from: start, to: end)
        }
    }

    /// A one-line field: `UITextField` at the view's text insets.
    final class SingleLineTextField: UITextField, NativeTextField, UITextFieldDelegate {
        weak var owner: TextInputNodeView?
        private var insets: UIEdgeInsets = .zero

        init() {
            super.init(frame: .zero)
            delegate = self
            borderStyle = .none
            backgroundColor = .clear
            isAccessibilityElement = true
            addTarget(self, action: #selector(editingChanged), for: .editingChanged)
        }

        @available(*, unavailable)
        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        var fieldText: String {
            get { text ?? "" }
            set { text = newValue }
        }

        var isDisabled: Bool {
            get { !isEnabled }
            set { isEnabled = !newValue }
        }

        func applyStyle(_ style: TextFieldStyle) {
            var attributes = style.text
            attributes[.paragraphStyle] = style.paragraph
            defaultTextAttributes = attributes
            var placeholderAttributes = style.placeholderAttributes
            placeholderAttributes[.paragraphStyle] = style.paragraph
            attributedPlaceholder = style.placeholder.map {
                NSAttributedString(string: $0, attributes: placeholderAttributes)
            }
            tintColor = style.caretColor
            insets = style.insets
            setNeedsLayout()
        }

        func textDidChangeShown() {}

        override func textRect(forBounds bounds: CGRect) -> CGRect {
            return bounds.inset(by: insets)
        }

        override func editingRect(forBounds bounds: CGRect) -> CGRect {
            return bounds.inset(by: insets)
        }

        override func placeholderRect(forBounds bounds: CGRect) -> CGRect {
            return bounds.inset(by: insets)
        }

        // Autofill, and anything else that sets the whole text, reports like typing.
        override var text: String? {
            didSet { owner?.fieldChanged() }
        }

        @objc private func editingChanged() {
            owner?.fieldChanged()
        }

        override func insertText(_ text: String) {
            guard let owner else {
                return
            }
            if text == "\n" {
                // One line: the return key only acts.
                _ = owner.returnKeyPressed()
                return
            }
            if owner.allowsInsert(text) {
                owner.willEdit(typingRange, inserting: text)
                super.insertText(text)
                owner.fieldChanged()
            }
        }

        override func deleteBackward() {
            if let owner, !owner.isReadOnly, !owner.isDisabled {
                owner.willEdit(deletionRange, inserting: "")
                super.deleteBackward()
                owner.fieldChanged()
            }
        }

        override func replace(_ range: UITextRange, withText text: String) {
            if let owner, !owner.isReadOnly, !owner.isDisabled {
                owner.willEdit(utf16Range(range), inserting: text)
                super.replace(range, withText: text)
                owner.fieldChanged()
            }
        }

        override func setMarkedText(_ markedText: String?, selectedRange: NSRange) {
            owner?.willEdit(typingRange, inserting: markedText ?? "")
            super.setMarkedText(markedText, selectedRange: selectedRange)
            owner?.fieldChanged()
        }

        override func unmarkText() {
            super.unmarkText()
            // The composition ended, maybe with the same text: reported with composing false.
            owner?.fieldChanged()
        }

        override func didMoveToWindow() {
            super.didMoveToWindow()
            owner?.takeFocusIfPossible()
        }

        override func becomeFirstResponder() -> Bool {
            return TextInputNodeView.takingFocus(self) { super.becomeFirstResponder() }
        }

        // MARK: UITextFieldDelegate

        func textFieldShouldBeginEditing(_ textField: UITextField) -> Bool {
            return owner?.isDisabled != true
        }

        func textFieldDidBeginEditing(_ textField: UITextField) {
            owner?.editingBegan()
        }

        func textFieldDidEndEditing(_ textField: UITextField) {
            owner?.editingEnded(self)
        }

        func textFieldDidChangeSelection(_ textField: UITextField) {
            owner?.fieldChanged()
        }

        func textField(
            _ textField: UITextField, shouldChangeCharactersIn range: NSRange,
            replacementString string: String
        ) -> Bool {
            guard let owner, owner.allowsEdit(of: range, with: string) else {
                return false
            }
            owner.willEdit(range, inserting: string)
            return true
        }

        func textFieldShouldReturn(_ textField: UITextField) -> Bool {
            _ = owner?.returnKeyPressed()
            return false
        }

        // MARK: Accessibility and privacy

        override var accessibilityLabel: String? {
            get { owner?.fieldLabel ?? super.accessibilityLabel }
            set {}
        }

        override var accessibilityHint: String? {
            get { owner?.props["accessibilityHint"]?.string }
            set {}
        }

        override var accessibilityTraits: UIAccessibilityTraits {
            get {
                var traits = super.accessibilityTraits.union(owner?.roleTraits ?? [])
                if isDisabled {
                    traits.insert(.notEnabled)
                }
                return traits
            }
            set {}
        }

        /// VoiceOver's escape puts the keyboard away; without it, escape goes on to the flow.
        override func accessibilityPerformEscape() -> Bool {
            guard isFirstResponder else {
                return false
            }
            return resignFirstResponder()
        }

        override var description: String {
            // Never UIKit's, which shows the text.
            return "<SingleLineTextField>"
        }

        override var debugDescription: String {
            return description
        }
    }

    /// A multiline field: `UITextView` at the view's text insets, with a placeholder of its own.
    final class MultilineTextView: UITextView, NativeTextField, UITextViewDelegate {
        weak var owner: TextInputNodeView?
        private let placeholderLabel = UILabel()
        private var style: TextFieldStyle?

        init() {
            super.init(frame: .zero, textContainer: nil)
            delegate = self
            backgroundColor = .clear
            textContainer.lineFragmentPadding = 0
            contentInsetAdjustmentBehavior = .never
            isAccessibilityElement = true
            placeholderLabel.numberOfLines = 0
            placeholderLabel.isAccessibilityElement = false
            placeholderLabel.isUserInteractionEnabled = false
            addSubview(placeholderLabel)
        }

        @available(*, unavailable)
        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        var fieldText: String {
            get { text ?? "" }
            set {
                // Typed text takes the typing attributes; a whole new text takes the style.
                attributedText = NSAttributedString(string: newValue, attributes: textAttributes)
            }
        }

        var isDisabled: Bool = false {
            didSet {
                isEditable = !isDisabled
                isSelectable = !isDisabled
            }
        }

        private var textAttributes: [NSAttributedString.Key: Any] {
            guard let style else {
                return typingAttributes
            }
            var attributes = style.text
            let paragraph = (style.paragraph.mutableCopy() as? NSMutableParagraphStyle)
                ?? NSMutableParagraphStyle()
            paragraph.minimumLineHeight = style.lineHeight
            paragraph.maximumLineHeight = style.lineHeight
            attributes[.paragraphStyle] = paragraph
            // Each line's glyphs sit centred in its height, as the core lays text out.
            if let font = style.text[.font] as? UIFont {
                attributes[.baselineOffset] = (style.lineHeight - font.lineHeight) / 4
            }
            return attributes
        }

        func applyStyle(_ style: TextFieldStyle) {
            self.style = style
            let attributes = textAttributes
            typingAttributes = attributes
            if markedTextRange == nil, textStorage.length > 0 {
                textStorage.setAttributes(
                    attributes, range: NSRange(location: 0, length: textStorage.length))
            }
            tintColor = style.caretColor
            textContainerInset = style.insets
            var placeholderAttributes = style.placeholderAttributes
            placeholderAttributes[.paragraphStyle] = attributes[.paragraphStyle]
            placeholderAttributes[.baselineOffset] = attributes[.baselineOffset]
            placeholderLabel.attributedText = style.placeholder.map {
                NSAttributedString(string: $0, attributes: placeholderAttributes)
            }
            textDidChangeShown()
            setNeedsLayout()
        }

        func textDidChangeShown() {
            placeholderLabel.isHidden = !(text ?? "").isEmpty || markedTextRange != nil
        }

        override func layoutSubviews() {
            super.layoutSubviews()
            let box = bounds.inset(by: textContainerInset)
            placeholderLabel.frame = CGRect(
                x: box.minX, y: box.minY, width: max(0, box.width),
                height: placeholderLabel.sizeThatFits(
                    CGSize(width: max(0, box.width), height: .greatestFiniteMagnitude)
                ).height)
        }

        override var text: String! {
            didSet { owner?.fieldChanged() }
        }

        override func setMarkedText(_ markedText: String?, selectedRange: NSRange) {
            owner?.willEdit(typingRange, inserting: markedText ?? "")
            super.setMarkedText(markedText, selectedRange: selectedRange)
            owner?.fieldChanged()
        }

        override func unmarkText() {
            super.unmarkText()
            owner?.fieldChanged()
        }

        override func didMoveToWindow() {
            super.didMoveToWindow()
            owner?.takeFocusIfPossible()
        }

        override func becomeFirstResponder() -> Bool {
            return TextInputNodeView.takingFocus(self) { super.becomeFirstResponder() }
        }

        // MARK: UITextViewDelegate

        func textViewShouldBeginEditing(_ textView: UITextView) -> Bool {
            return owner?.isDisabled != true
        }

        func textViewDidBeginEditing(_ textView: UITextView) {
            owner?.editingBegan()
        }

        func textViewDidEndEditing(_ textView: UITextView) {
            owner?.editingEnded(self)
        }

        func textViewDidChange(_ textView: UITextView) {
            owner?.fieldChanged()
        }

        override func insertText(_ text: String) {
            guard let owner else {
                return
            }
            if text == "\n", markedTextRange == nil, !owner.returnKeyPressed() {
                return
            }
            if owner.allowsInsert(text) {
                owner.willEdit(typingRange, inserting: text)
                super.insertText(text)
                owner.fieldChanged()
            }
        }

        override func deleteBackward() {
            if let owner, !owner.isReadOnly, !owner.isDisabled {
                owner.willEdit(deletionRange, inserting: "")
                super.deleteBackward()
                owner.fieldChanged()
            }
        }

        override func replace(_ range: UITextRange, withText text: String) {
            if let owner, !owner.isReadOnly, !owner.isDisabled {
                owner.willEdit(utf16Range(range), inserting: text)
                super.replace(range, withText: text)
                owner.fieldChanged()
            }
        }

        func textViewDidChangeSelection(_ textView: UITextView) {
            owner?.fieldChanged()
        }

        func textView(
            _ textView: UITextView, shouldChangeTextIn range: NSRange, replacementText text: String
        ) -> Bool {
            guard let owner else {
                return false
            }
            // `UITextView` sends a line break for every return key: one labelled otherwise acts.
            if text == "\n", markedTextRange == nil, !owner.returnKeyPressed() {
                return false
            }
            guard owner.allowsEdit(of: range, with: text) else {
                return false
            }
            owner.willEdit(range, inserting: text)
            return true
        }

        // MARK: Accessibility and privacy

        override var accessibilityLabel: String? {
            get { owner?.fieldLabel ?? super.accessibilityLabel }
            set {}
        }

        override var accessibilityHint: String? {
            get { owner?.props["accessibilityHint"]?.string }
            set {}
        }

        override var accessibilityTraits: UIAccessibilityTraits {
            get {
                var traits = super.accessibilityTraits.union(owner?.roleTraits ?? [])
                if isDisabled {
                    traits.insert(.notEnabled)
                }
                return traits
            }
            set {}
        }

        override func accessibilityPerformEscape() -> Bool {
            guard isFirstResponder else {
                return false
            }
            return resignFirstResponder()
        }

        override var description: String {
            return "<MultilineTextView>"
        }

        override var debugDescription: String {
            return description
        }
    }

    extension TextInputNodeView {
        /// Traits of the flow's role and state over the field's own: a `search` role, a
        /// disabled or busy state. `textfield` adds nothing to a text field.
        fileprivate var roleTraits: UIAccessibilityTraits {
            let role = props["accessibilityRole"]?.string
            return NodeView.traits(
                role: role == "textfield" ? nil : role, state: props["accessibilityState"])
        }
    }
#endif
