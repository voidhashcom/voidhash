import { describe, expect, test } from "vitest";

import {
  CompositionError,
  parseComposition,
  printComposition,
  type CompositionRegistry,
} from "../src/compose/index";

/**
 * Pure (mimic-free) round-trip: parse → print is a stable fixpoint, and the
 * printed source re-parses to an identical print. The mimic reconcile-to-zero
 * assertions live in the closed `paywall-composition` bridge tests, which lower
 * the AST to a document and diff. Here we prove the AST↔source half is lossless
 * and deterministic.
 */
const roundtrip = (source: string, registry?: CompositionRegistry): string => {
  const opts = registry ? { registry } : undefined;
  const printed1 = printComposition(parseComposition(source, opts), opts);
  const printed2 = printComposition(parseComposition(printed1, opts), opts);
  expect(printed2).toBe(printed1);
  return printed1;
};

const FIXTURE = `
import { paywall, Screen, View, Text, variable, product, purchase, closePaywall } from "@voidhash/paywalls/compose";

export default paywall(() => {
  const selected = variable.product("selectedProduct");
  const promo = variable.boolean("promo", { default: true });

  return (
    <Screen name="Main" style={{ backgroundColor: "rgba(10, 10, 20, 1)", safeAreaTop: true }}>
      <View name="Header" style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16 }}>
        <Text style={{ fontSize: 28, color: "rgba(255, 255, 255, 1)" }}>Unlock Pro</Text>
        <View name="Close" onPress={closePaywall()} />
      </View>
      <View name="CTA" style={{ paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16 }} onPress={purchase(selected)}>
        <Text style={{ fontSize: 18 }}>Continue</Text>
      </View>
      <View name="Pick" onPress={selected.set(product("yearly"))} />
    </Screen>
  );
});
`;

describe("composition grammar + printer (pure)", () => {
  test("parses the fixture into a well-formed AST", () => {
    const ast = parseComposition(FIXTURE);
    expect(ast.root.type).toBe("screen");
    expect(ast.variables.map((v) => v.name).sort()).toEqual(["promo", "selectedProduct"]);
    const header = ast.root.children[0]!;
    expect(header.kind).toBe("element");
    if (header.kind === "element") {
      expect(header.type).toBe("view");
      expect(header.style["flexDirection"]).toBe("row");
      expect(header.style["paddingTop"]).toBe(16);
      expect(header.style["paddingLeft"]).toBe(16);
    }
  });

  test("parse → print is a stable, idempotent fixpoint", () => {
    roundtrip(FIXTURE);
  });

  test("printed source is stable and readable", () => {
    const printed = printComposition(parseComposition(FIXTURE));
    expect(printed).toContain('const selectedProduct = variable.product("selectedProduct")');
    expect(printed).toContain('const promo = variable.boolean("promo", { default: true })');
    expect(printed).toContain(
      "style={{ paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16 }}",
    );
    expect(printed).toContain("onPress={closePaywall()}");
    expect(printed).toContain("onPress={purchase(selectedProduct)}");
    expect(printed).toContain('onPress={selectedProduct.set(product("yearly"))}');
    expect(printed.split("\n")[0]).toContain('from "@voidhash/paywalls/compose"');
  });

  test("a scalar edit in printed source re-parses+re-prints with only that change", () => {
    const printed = printComposition(parseComposition(FIXTURE));
    const edited = printed.replace("Continue", "Subscribe");
    const reprinted = printComposition(parseComposition(edited));
    expect(reprinted).toContain("Subscribe");
    expect(reprinted).not.toContain(">Continue<");
  });
});

describe("round-trip fidelity — escaping + numeric edge cases", () => {
  test("negative numeric style values round-trip (unary minus)", () => {
    const src = `import { paywall, Screen, View } from "@voidhash/paywalls/compose";
export default paywall(() => (<Screen><View name="M" style={{ marginTop: -4 }} /></Screen>));`;
    expect(printComposition(parseComposition(src))).toContain("style={{ marginTop: -4 }}");
    roundtrip(src);
  });

  test("text with JSX-special characters round-trips via a string literal", () => {
    const src = `import { paywall, Screen, Text } from "@voidhash/paywalls/compose";
export default paywall(() => (<Screen><Text>{"save > 50% {today}"}</Text></Screen>));`;
    const printed = printComposition(parseComposition(src));
    expect(printed).toContain('{"save > 50% {today}"}');
    roundtrip(src);
  });

  test("text with significant whitespace round-trips exactly", () => {
    const src = `import { paywall, Screen, Text } from "@voidhash/paywalls/compose";
export default paywall(() => (<Screen><Text>{"  spaced  "}</Text></Screen>));`;
    roundtrip(src);
  });

  test("absolute position + offsets round-trip (emitted in registry order)", () => {
    const src = `import { paywall, Screen, View } from "@voidhash/paywalls/compose";
export default paywall(() => (<Screen><View name="Badge" style={{ position: "absolute", top: 10, left: 20 }} /></Screen>));`;
    const printed = printComposition(parseComposition(src));
    // Registry style order emits position, then left, then top.
    expect(printed).toContain('style={{ position: "absolute", left: 20, top: 10 }}');
    roundtrip(src);
  });

  test('the default position: "relative" (and "auto" offsets) are omitted on print', () => {
    const src = `import { paywall, Screen, View } from "@voidhash/paywalls/compose";
export default paywall(() => (<Screen><View name="Flow" style={{ position: "relative", top: "auto", left: 4 }} /></Screen>));`;
    const printed = printComposition(parseComposition(src));
    // Only the non-default offset survives; the default position/offset are dropped.
    expect(printed).toContain("style={{ left: 4 }}");
    expect(printed).not.toContain("position:");
    expect(printed).not.toContain('top: "auto"');
    roundtrip(src);
  });

  test("<Text> absolute position + offsets round-trip (emitted in registry order)", () => {
    const src = `import { paywall, Screen, Text } from "@voidhash/paywalls/compose";
export default paywall(() => (<Screen><Text style={{ position: "absolute", top: 10, left: 20 }}>Badge</Text></Screen>));`;
    const printed = printComposition(parseComposition(src));
    // Registry style order emits position, then left, then top.
    expect(printed).toContain('style={{ position: "absolute", left: 20, top: 10 }}');
    roundtrip(src);
  });

  test('<Text> default position: "relative" (and "auto" offsets) are omitted on print', () => {
    const src = `import { paywall, Screen, Text } from "@voidhash/paywalls/compose";
export default paywall(() => (<Screen><Text style={{ position: "relative", top: "auto", left: 4 }}>Flow</Text></Screen>));`;
    const printed = printComposition(parseComposition(src));
    // Only the non-default offset survives; the default position/offset are dropped.
    expect(printed).toContain("style={{ left: 4 }}");
    expect(printed).not.toContain("position:");
    expect(printed).not.toContain('top: "auto"');
    roundtrip(src);
  });

  test("<View onPress={none()}> round-trips (fresh designer interaction)", () => {
    // A designer-authored `<View>` with a fresh (`{type:"none"}`) click
    // interaction lifts + prints to `onPress={none()}`; the node-level grammar
    // must parse it back or the code-mode round trip breaks.
    const src = `import { paywall, Screen, View, none } from "@voidhash/paywalls/compose";
export default paywall(() => (<Screen><View name="F" onPress={none()} /></Screen>));`;
    const ast = parseComposition(src);
    const view = ast.root.children[0]!;
    expect(view.kind).toBe("element");
    if (view.kind === "element") {
      expect(view.interactions).toEqual([{ trigger: "click", action: { kind: "none" } }]);
    }
    const printed = printComposition(ast);
    expect(printed).toContain("onPress={none()}");
    roundtrip(src);
  });
});

describe("grammar rejects", () => {
  test("rejects duplicate variable names", () => {
    const src = `import { paywall, Screen, variable } from "@voidhash/paywalls/compose";
export default paywall(() => {
  const a = variable.string("dup");
  const b = variable.number("dup");
  return (<Screen name="S" />);
});`;
    expect(() => parseComposition(src)).toThrow(CompositionError);
  });

  test("rejects non-identifier variable names", () => {
    const src = `import { paywall, Screen, variable } from "@voidhash/paywalls/compose";
export default paywall(() => {
  const a = variable.string("has trial");
  return (<Screen name="S" />);
});`;
    expect(() => parseComposition(src)).toThrow(CompositionError);
  });

  test("rejects options on a product variable", () => {
    const src = `import { paywall, Screen, variable } from "@voidhash/paywalls/compose";
export default paywall(() => {
  const p = (variable as any).product("p", { default: "x" });
  return (<Screen name="S" />);
});`;
    expect(() => parseComposition(src)).toThrow(CompositionError);
  });

  test("rejects a type-mismatched set-variable value", () => {
    const src = `import { paywall, Screen, View, variable } from "@voidhash/paywalls/compose";
export default paywall(() => {
  const p = variable.product("p");
  return (<Screen><View name="F" onPress={p.set("not-a-product")} /></Screen>);
});`;
    expect(() => parseComposition(src)).toThrow(CompositionError);
  });

  // NOTE: `<View style={{ gap: "lots" }} />` (string on a numeric field) is
  // accepted by the pure grammar — the parser has no notion of a style field's
  // value TYPE. It is rejected by the mimic schema encode gate in the closed
  // `lowerAst`, so that rejection test lives in the mono `paywall-composition`
  // bridge tests, not here.

  const rejects = (body: string): void => {
    const source = `import { paywall, Screen, View, Text } from "@voidhash/paywalls/compose";\nexport default paywall(() => (${body}));`;
    expect(() => parseComposition(source)).toThrow(CompositionError);
  };

  test("rejects .map() control flow", () => {
    rejects("<Screen>{items.map((x) => <Text>{x}</Text>)}</Screen>");
  });

  test("rejects a ternary inside a style value", () => {
    rejects("<Screen><View style={{ paddingTop: cond ? 1 : 2 }} /></Screen>");
  });

  test("rejects the removed padding shorthand (unknown style key)", () => {
    rejects("<Screen><View style={{ padding: 16 }} /></Screen>");
  });

  test("rejects a removed style alias (unknown style key)", () => {
    rejects('<Screen><View style={{ bg: "rgba(0, 0, 0, 1)" }} /></Screen>');
  });

  test("rejects unknown elements", () => {
    rejects("<Screen><Widget /></Screen>");
  });

  test("rejects spread attributes", () => {
    rejects("<Screen><View {...rest} /></Screen>");
  });

  test("rejects variable-bound text (needs a code component)", () => {
    rejects("<Screen><Text>{someVar}</Text></Screen>");
  });

  test("rejects a text attribute on <Text> (content is JSX children)", () => {
    rejects('<Screen><Text text="Hi" /></Screen>');
  });

  test("rejects onPress on non-view nodes", () => {
    rejects("<Screen onPress={closePaywall()}><Text>Hi</Text></Screen>");
  });

  test("CompositionError carries 0-based line/column", () => {
    const src = `import { paywall, Screen, View } from "@voidhash/paywalls/compose";
export default paywall(() => (<Screen><Widget /></Screen>));`;
    try {
      parseComposition(src);
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(CompositionError);
      const e = error as CompositionError;
      expect(e.line).toBe(1); // 0-based: second line
      expect(typeof e.column).toBe("number");
    }
  });
});

describe("code-component instances (pure)", () => {
  const registry: CompositionRegistry = {
    components: [
      {
        tag: "ProductOption",
        source: "local",
        localComponentId: "cc_1",
        componentSlug: "product-option",
        componentVersion: 0,
        contentHash: "",
        manifest: {
          slot: true,
          props: {
            title: { kind: "string" },
            price: { kind: "number" },
            featured: { kind: "boolean" },
            plan: { kind: "select", options: ["monthly", "yearly"] },
            product: { kind: "ref", refType: "product" },
            features: { kind: "array", item: { kind: "string" } },
          },
          actions: {
            onSelect: { payload: { productId: { kind: "string" } } },
          },
        },
      },
    ],
  };

  const CFIXTURE = `
import { paywall, Screen, View, Text, variable, product, purchase, payload, ProductOption } from "@voidhash/paywalls/compose";

export default paywall(() => {
  const selected = variable.product("selectedProduct");

  return (
    <Screen name="Main" style={{ backgroundColor: "rgba(10, 10, 20, 1)" }}>
      <ProductOption name="Yearly" title="Yearly Plan" price={99} featured plan="yearly" product={selected} features={["Unlimited", "Priority"]} onSelect={purchase(payload("productId"))}>
        <Text style={{ fontSize: 14 }}>Best value</Text>
      </ProductOption>
    </Screen>
  );
});
`;

  test("parses a <Component> into a well-formed component AST node", () => {
    const ast = parseComposition(CFIXTURE, { registry });
    const component = ast.root.children[0]!;
    expect(component.kind).toBe("component");
    if (component.kind !== "component") return;
    expect(component.tag).toBe("ProductOption");
    expect(component.name).toBe("Yearly");
    const props = Object.fromEntries(component.props.map((p) => [p.name, p.value]));
    expect(props["title"]).toEqual({ kind: "literal-string", value: "Yearly Plan" });
    expect(props["price"]).toEqual({ kind: "literal-number", value: 99 });
    expect(props["featured"]).toEqual({ kind: "literal-boolean", value: true });
    expect(props["plan"]).toEqual({ kind: "literal-string", value: "yearly" });
    expect(props["product"]).toEqual({ kind: "variable", variableName: "selectedProduct" });
    expect(props["features"]).toEqual({
      kind: "literal-string-array",
      value: ["Unlimited", "Priority"],
    });
    expect(component.actionBindings[0]).toEqual({
      name: "onSelect",
      action: { kind: "purchase", product: { kind: "payload", field: "productId" } },
    });
  });

  test("component instance round-trips (parse↔print fixpoint)", () => {
    roundtrip(CFIXTURE, registry);
  });

  test("props parse in manifest order regardless of source attribute order", () => {
    const inOrder = `import { paywall, Screen, ProductOption } from "@voidhash/paywalls/compose";
export default paywall(() => (<Screen name="Main"><ProductOption title="X" price={99} featured plan="yearly" /></Screen>));`;
    const outOfOrder = `import { paywall, Screen, ProductOption } from "@voidhash/paywalls/compose";
export default paywall(() => (<Screen name="Main"><ProductOption plan="yearly" price={99} featured title="X" /></Screen>));`;
    const a = parseComposition(inOrder, { registry });
    const b = parseComposition(outOfOrder, { registry });
    const nameOrder = (ast: typeof a) => {
      const c = ast.root.children[0]!;
      return c.kind === "component" ? c.props.map((p) => p.name) : [];
    };
    expect(nameOrder(a)).toEqual(nameOrder(b));
    expect(printComposition(a, { registry })).toBe(printComposition(b, { registry }));
  });

  test("a string prop containing a tab round-trips exactly (expression form)", () => {
    const src = `import { paywall, Screen, ProductOption } from "@voidhash/paywalls/compose";
export default paywall(() => (<Screen name="Main"><ProductOption title={"a\\tb"} /></Screen>));`;
    const printed = printComposition(parseComposition(src, { registry }), { registry });
    expect(printed).toContain('title={"a\\tb"}');
    roundtrip(src, registry);
  });

  test("rejects an unknown prop", () => {
    const src = CFIXTURE.replace('title="Yearly Plan"', 'bogus="x" title="Yearly Plan"');
    expect(() => parseComposition(src, { registry })).toThrow(/Unknown prop "bogus"/);
  });

  test("without a registry, a component tag is an unknown element", () => {
    expect(() => parseComposition(CFIXTURE)).toThrow(/Unknown element <ProductOption>/);
  });

  test('a manifest prop literally named "name" is not swallowed by the display-name attribute', () => {
    const nameRegistry: CompositionRegistry = {
      components: [
        {
          tag: "Widget",
          source: "local",
          localComponentId: "cc_w",
          componentSlug: "widget",
          componentVersion: 0,
          contentHash: "",
          manifest: { slot: false, props: { name: { kind: "string" } }, actions: {} },
        },
      ],
    };
    const src = `import { paywall, Screen, Widget } from "@voidhash/paywalls/compose";
export default paywall(() => (<Screen name="Main"><Widget name="Buy now" /></Screen>));`;
    const ast = parseComposition(src, { registry: nameRegistry });
    const widget = ast.root.children[0]!;
    expect(widget.kind).toBe("component");
    if (widget.kind !== "component") return;
    expect(widget.name).toBeUndefined();
    expect(widget.props).toEqual([
      { name: "name", value: { kind: "literal-string", value: "Buy now" } },
    ]);
    roundtrip(src, nameRegistry);
  });
});

describe("structured background style values (gradient + image)", () => {
  test("a non-default gradient parses into JSON style data", () => {
    const src = `import { paywall, Screen, View } from "@voidhash/paywalls/compose";
export default paywall(() => (
  <Screen>
    <View name="Card" style={{ backgroundType: "gradient", backgroundGradient: { kind: "radial", startX: 0, startY: 0, endX: 1, endY: 1, stops: [{ color: "rgba(255, 0, 0, 1)", position: 0 }, { color: "rgba(0, 0, 255, 1)", position: 1 }] } }} />
  </Screen>
));`;
    const ast = parseComposition(src);
    const card = ast.root.children[0]!;
    expect(card.kind).toBe("element");
    if (card.kind !== "element") return;
    expect(card.style["backgroundType"]).toBe("gradient");
    expect(card.style["backgroundGradient"]).toEqual({
      kind: "radial",
      startX: 0,
      startY: 0,
      endX: 1,
      endY: 1,
      stops: [
        { color: "rgba(255, 0, 0, 1)", position: 0 },
        { color: "rgba(0, 0, 255, 1)", position: 1 },
      ],
    });
  });

  test("a non-default gradient prints as a deterministic JSX object expression", () => {
    const src = `import { paywall, Screen, View } from "@voidhash/paywalls/compose";
export default paywall(() => (<Screen><View name="Card" style={{ backgroundType: "gradient", backgroundGradient: { kind: "linear", startX: 0, startY: 0, endX: 1, endY: 1, stops: [{ color: "rgba(255, 0, 0, 1)", position: 0 }, { color: "rgba(0, 0, 255, 1)", position: 1 }] } }} /></Screen>));`;
    const printed = printComposition(parseComposition(src));
    expect(printed).toContain(
      'style={{ backgroundType: "gradient", backgroundGradient: { kind: "linear", startX: 0, startY: 0, endX: 1, endY: 1, stops: [{ color: "rgba(255, 0, 0, 1)", position: 0 }, { color: "rgba(0, 0, 255, 1)", position: 1 }] } }}',
    );
    roundtrip(src);
  });

  test("an image background round-trips", () => {
    const src = `import { paywall, Screen, View } from "@voidhash/paywalls/compose";
export default paywall(() => (<Screen><View name="Hero" style={{ backgroundType: "image", backgroundImage: { url: "https://example.com/bg.png", resizeMode: "contain" } }} /></Screen>));`;
    const printed = printComposition(parseComposition(src));
    expect(printed).toContain(
      'style={{ backgroundType: "image", backgroundImage: { url: "https://example.com/bg.png", resizeMode: "contain" } }}',
    );
    roundtrip(src);
  });

  test("the default gradient + image values are omitted on print", () => {
    // The View defaults carry backgroundType "solid" plus the canonical gradient
    // and image defaults; setting them explicitly must print nothing for them —
    // so the all-default element prints no style attribute at all.
    const src = `import { paywall, Screen, View } from "@voidhash/paywalls/compose";
export default paywall(() => (<Screen><View name="Plain" style={{ backgroundType: "solid", backgroundGradient: { kind: "linear", startX: 0.5, startY: 0, endX: 0.5, endY: 1, stops: [{ color: "rgba(255, 255, 255, 1)", position: 0 }, { color: "rgba(255, 255, 255, 0)", position: 1 }] }, backgroundImage: { url: "", resizeMode: "cover" } }} /></Screen>));`;
    const printed = printComposition(parseComposition(src));
    expect(printed).not.toContain("backgroundType");
    expect(printed).not.toContain("backgroundGradient");
    expect(printed).not.toContain("backgroundImage");
    expect(printed).not.toContain("style=");
    roundtrip(src);
  });

  test("rejects a non-literal style value (identifier)", () => {
    const src = `import { paywall, Screen, View } from "@voidhash/paywalls/compose";
const x = 1;
export default paywall(() => (<Screen><View name="Bad" style={{ backgroundImage: { url: x, resizeMode: "cover" } }} /></Screen>));`;
    expect(() => parseComposition(src)).toThrow();
  });

  test("rejects a spread inside a style value", () => {
    const src = `import { paywall, Screen, View } from "@voidhash/paywalls/compose";
const base = {};
export default paywall(() => (<Screen><View name="Bad" style={{ backgroundImage: { ...base, resizeMode: "cover" } }} /></Screen>));`;
    expect(() => parseComposition(src)).toThrow();
  });
});

describe("style={{ … }} object grammar", () => {
  const parse = (body: string) => {
    const source = `import { paywall, Screen, View, Text } from "@voidhash/paywalls/compose";\nexport default paywall(() => (${body}));`;
    return parseComposition(source);
  };
  const messageOf = (body: string): string => {
    try {
      parse(body);
    } catch (error) {
      if (error instanceof CompositionError) {
        return error.message;
      }
      throw error;
    }
    throw new Error("expected a CompositionError");
  };

  test("style={{}} parses as an empty style (legal)", () => {
    const ast = parse('<Screen><View name="Empty" style={{}} /></Screen>');
    const view = ast.root.children[0]!;
    expect(view.kind).toBe("element");
    if (view.kind === "element") {
      expect(view.style).toEqual({});
    }
  });

  test("a former FLAT style attribute is a migration error guiding to style={{ … }}", () => {
    const message = messageOf('<Screen><View paddingTop={16} /></Screen>');
    expect(message).toContain("style={{");
    expect(message).toContain('"paddingTop"');
  });

  test("a duplicate style key is a hard error", () => {
    const message = messageOf('<Screen><View style={{ paddingTop: 8, paddingTop: 16 }} /></Screen>');
    expect(message).toContain('Duplicate style key "paddingTop"');
  });

  test("an unknown style key errors with a did-you-mean suggestion", () => {
    const message = messageOf('<Screen><View style={{ paddingTp: 4 }} /></Screen>');
    expect(message).toContain('Unknown style key "paddingTp"');
    expect(message).toContain('did you mean "paddingTop"');
  });

  test("a shorthand property inside style is rejected", () => {
    const src = `import { paywall, Screen, View } from "@voidhash/paywalls/compose";
const paddingTop = 4;
export default paywall(() => (<Screen><View style={{ paddingTop }} /></Screen>));`;
    expect(() => parseComposition(src)).toThrow(CompositionError);
  });

  test("a spread property inside style is rejected", () => {
    const src = `import { paywall, Screen, View } from "@voidhash/paywalls/compose";
const base = {};
export default paywall(() => (<Screen><View style={{ ...base }} /></Screen>));`;
    expect(() => parseComposition(src)).toThrow(CompositionError);
  });

  test("a computed property name inside style is rejected", () => {
    const src = `import { paywall, Screen, View } from "@voidhash/paywalls/compose";
const key = "paddingTop";
export default paywall(() => (<Screen><View style={{ [key]: 4 }} /></Screen>));`;
    expect(() => parseComposition(src)).toThrow(CompositionError);
  });

  test("a style attribute on a component tag is an unknown-attribute error", () => {
    const registry: CompositionRegistry = {
      components: [
        {
          tag: "Widget",
          source: "local",
          localComponentId: "cc_w",
          componentSlug: "widget",
          componentVersion: 0,
          contentHash: "",
          manifest: { slot: false, props: {}, actions: {} },
        },
      ],
    };
    const src = `import { paywall, Screen, Widget } from "@voidhash/paywalls/compose";
export default paywall(() => (<Screen name="Main"><Widget style={{ paddingTop: 4 }} /></Screen>));`;
    expect(() => parseComposition(src, { registry })).toThrow(/Unknown prop "style"/);
  });

  test("fixpoint: mixed style values (negative number, JSX-special string, gradient, boolean) + an all-default element", () => {
    const src = `import { paywall, Screen, View, Text } from "@voidhash/paywalls/compose";
export default paywall(() => (
  <Screen style={{ safeAreaTop: true, backgroundType: "gradient", backgroundGradient: { kind: "linear", startX: 0, startY: 0, endX: 1, endY: 1, stops: [{ color: "rgba(0, 0, 0, 1)", position: 0 }] } }}>
    <View name="Neg" style={{ marginTop: -4 }} />
    <Text>{"save > 50% {today}"}</Text>
    <View name="Default" />
  </Screen>
));`;
    const printed = printComposition(parseComposition(src));
    // Fixpoint: print → parse → print is byte-identical.
    expect(printComposition(parseComposition(printed))).toBe(printed);
    expect(printed).toContain("style={{ marginTop: -4 }}");
    expect(printed).toContain('{"save > 50% {today}"}');
    expect(printed).toContain("safeAreaTop: true");
    expect(printed).toContain(
      'backgroundGradient: { kind: "linear", startX: 0, startY: 0, endX: 1, endY: 1, stops: [{ color: "rgba(0, 0, 0, 1)", position: 0 }] }',
    );
    // The all-default View prints with no style attribute.
    expect(printed).toContain('<View name="Default" />');
  });
});
