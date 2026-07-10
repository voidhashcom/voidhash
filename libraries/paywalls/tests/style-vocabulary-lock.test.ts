import { describe, expect, it } from "vitest";

import { PAYWALL_STYLE_KEY_LIST } from "../src/schema/index";

/**
 * Content-and-order lock for the §3.1 wire-contract style keys.
 *
 * `PAYWALL_STYLE_KEY_LIST` is derived from the single style-field registry
 * (`src/schema/style-registry.ts` `WIRE_STYLE_ORDER`). This test hardcodes its
 * EXACT value so the derivation can never silently drift — a reorder, added, or
 * removed key fails here.
 */

const EXPECTED_STYLE_KEY_LIST = [
  "flex",
  "flexDirection",
  "alignItems",
  "alignSelf",
  "justifyContent",
  "flexWrap",
  "gap",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "paddingTop",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "aspectRatio",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderColor",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
  "borderStyle",
  "backgroundColor",
  "backgroundType",
  "backgroundGradient",
  "backgroundImage",
  "opacity",
  "overflow",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "zIndex",
  "color",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textTransform",
  "textDecorationLine",
  "fontFamily",
];

describe("PAYWALL_STYLE_KEY_LIST (wire contract lock)", () => {
  it("matches the locked content AND order exactly", () => {
    expect([...PAYWALL_STYLE_KEY_LIST]).toEqual(EXPECTED_STYLE_KEY_LIST);
  });
});
