import { expectTypeOf, test } from "vitest";

import type { ScreenProps, TextProps, ViewProps } from "../src/compose/style-attr-types";

/**
 * Type-level substance check for the precise `style={{ … }}` surface. Style fields
 * are nested under `style`; `name`/`onPress`/children are siblings. These
 * assertions are enforced by `tsgo` (the `typecheck` script includes `tests/`):
 * each `@ts-expect-error` fails the build if the surface stops rejecting the
 * erroneous usage, and the positive cases fail if a legal value is rejected.
 */

// --- valid: well-typed style + siblings on each node ----------------------
const _screen: ScreenProps = {
  name: "Main",
  style: {
    gap: 8,
    flexDirection: "column",
    backgroundColor: "rgba(0, 0, 0, 1)",
    width: "auto",
    safeAreaTop: true,
    backgroundType: "gradient",
    backgroundGradient: {
      kind: "linear",
      startX: 0,
      startY: 0,
      endX: 1,
      endY: 1,
      stops: [{ color: "rgba(0, 0, 0, 1)", position: 0 }],
    },
  },
};
void _screen;

const _text: TextProps = {
  style: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  children: "Hi",
};
void _text;

// --- invalid: unknown key inside style is rejected ------------------------
// @ts-expect-error unknown style key on <View>
const _typo: ViewProps = { style: { paddingTp: 4 } };
void _typo;

// --- invalid: wrong value type on a numeric field -------------------------
// @ts-expect-error gap is a number, not a string
const _gap: ViewProps = { style: { gap: "lots" } };
void _gap;

// --- invalid: value outside a field's enum --------------------------------
// @ts-expect-error flexDirection only accepts "row" | "column"
const _dir: ViewProps = { style: { flexDirection: "diagonal" } };
void _dir;

// --- invalid: a style field written FLAT (as a sibling) is rejected --------
// @ts-expect-error style fields live inside style={{ … }}, not as a flat attribute
const _flat: ViewProps = { gap: 8 };
void _flat;

// --- invalid: onPress must be an Action, and only on <View> ---------------
// @ts-expect-error onPress must be an Action marker, not a string
const _press: ViewProps = { onPress: "nope" };
void _press;

// @ts-expect-error onPress is a <View>-only attribute, not on <Screen>
const _screenPress: ScreenProps = { name: "S", onPress: {} as import("../src/compose/author-surface").Action };
void _screenPress;

// --- invalid: a style-key typo inside <Text> style ------------------------
// @ts-expect-error fontSize typo on <Text>
const _textTypo: TextProps = { style: { fontSze: 9 } };
void _textTypo;

test("compose surface types compile (see @ts-expect-error assertions)", () => {
  expectTypeOf<NonNullable<ViewProps["style"]>["gap"]>().toEqualTypeOf<number | undefined>();
  expectTypeOf<NonNullable<ScreenProps["style"]>["flexDirection"]>().toEqualTypeOf<
    "row" | "column" | undefined
  >();
});
