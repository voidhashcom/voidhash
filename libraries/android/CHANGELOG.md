# @voidhash/android

## 0.1.1

### Patch Changes

- On Android, a pressable part of a flow's text reaches TalkBack as a link rather than a button: TalkBack says "link" in the reader's language and lists it among the screen's links, and choosing it there or double-tapping it presses it.
- Flows tell VoiceOver and TalkBack what each layer is: a layer can carry an accessibility label (translated per language), a role (button, link, header or image), or be hidden from screen readers, and each pressable part of a text is reachable on its own. A pushed screen also settles faster when drawn outside the built-in renderer.

## 0.1.0

### Minor Changes

- First release on npm.
