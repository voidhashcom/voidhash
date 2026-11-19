# @voidhash/ios

## 0.1.1

### Patch Changes

- Flows tell VoiceOver and TalkBack what each layer is: a layer can carry an accessibility label (translated per language), a role (button, link, header or image), or be hidden from screen readers, and each pressable part of a text is reachable on its own. A pushed screen also settles faster when drawn outside the built-in renderer.
- The paywall engine linked into iOS apps is about 0.8 MB smaller: it is built without unwind tables for code that never unwinds, which the engine does not use.

## 0.1.0

### Minor Changes

- First release on npm.
