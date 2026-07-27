import { describe, expect, test } from "vite-plus/test";

import { componentWrapperStyle } from "./component-wrapper-style";

describe("componentWrapperStyle", () => {
  test("forwards flex-child sizing without copying visual styles", () => {
    expect(
      componentWrapperStyle({
        children: [],
        style: {
          alignSelf: "stretch",
          backgroundColor: "red",
          flex: 1,
          flexBasis: "auto",
          flexGrow: 2,
          flexShrink: 0,
        },
        type: "view",
      }),
    ).toEqual({
      alignSelf: "stretch",
      flex: 1,
      flexBasis: "auto",
      flexGrow: 2,
      flexShrink: 0,
    });
  });

  test("returns no explicit sizing for a hugging root", () => {
    expect(
      componentWrapperStyle({ children: [], style: { backgroundColor: "red" }, type: "view" }),
    ).toEqual({});
  });

  test("returns no explicit sizing for an unstyled root", () => {
    expect(componentWrapperStyle({ type: "slot" })).toEqual({});
  });
});
