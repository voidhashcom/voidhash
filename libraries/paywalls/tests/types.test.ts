/**
 * Type-level assertions for the authoring API. These run as a normal vitest
 * file but the value is in compilation: `expectTypeOf` failures break
 * `typecheck`.
 */
import type { ReactNode } from "react";
import { describe, expectTypeOf, it } from "vitest";
import { actionFactory } from "../src/authoring/actions";
import { propFactory } from "../src/authoring/props";
import {
  defineComponent,
  type InferActions,
  type InferComponentProps,
  type InferExternalProps,
  type InferProps,
  type PAYWALL_STYLE_KEY_LIST,
  type PaywallProduct,
  type PaywallStyle,
} from "../src/index";

const p = propFactory;
const a = actionFactory;

const propMap = {
  required: p.string(),
  optional: p.number().optional(),
  defaulted: p.boolean().default(true),
  optionalDefaulted: p.string().optional().default("x"),
  plan: p.select(["monthly", "yearly"]),
  product: p.ref("product"),
  badge: p.component().optional(),
  features: p.array(p.string()),
};

const actionMap = {
  onSelect: a.action({ productId: a.string(), index: a.number() }),
  onDismiss: a.action(),
};

type Props = InferProps<typeof propMap>;
type External = InferExternalProps<typeof propMap>;
type Actions = InferActions<typeof actionMap>;
type ComponentProps = InferComponentProps<typeof propMap, typeof actionMap>;

describe("PropBuilder.editor() (contract §2: string props only)", () => {
  it("is callable on string builders and uncallable on every other kind", () => {
    // Chaining keeps working in either order on strings.
    expectTypeOf(p.string().editor("color").default("#16a34a")).not.toBeNever();
    expectTypeOf(p.string().label("Accent").editor("color")).not.toBeNever();

    // @ts-expect-error editor() is a string-only UI hint
    p.number().editor("color");
    // @ts-expect-error editor() is a string-only UI hint
    p.boolean().editor("color");
    // @ts-expect-error editor() is a string-only UI hint
    p.select(["a", "b"]).editor("color");
    // @ts-expect-error editor() is a string-only UI hint
    p.image().editor("color");
    // @ts-expect-error editor() is a string-only UI hint
    p.ref("product").editor("color");
    // @ts-expect-error editor() is a string-only UI hint
    p.component().editor("color");
    // @ts-expect-error editor() is a string-only UI hint
    p.array(p.string()).editor("color");
  });
});

describe("InferProps (template-facing)", () => {
  it("infers value types and optionality", () => {
    expectTypeOf<Props["required"]>().toEqualTypeOf<string>();
    expectTypeOf<Props["optional"]>().toEqualTypeOf<number | undefined>();
    // Defaults are always filled before the template runs.
    expectTypeOf<Props["defaulted"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Props["optionalDefaulted"]>().toEqualTypeOf<string>();
    expectTypeOf<Props["plan"]>().toEqualTypeOf<"monthly" | "yearly">();
    expectTypeOf<Props["product"]>().toEqualTypeOf<PaywallProduct>();
    expectTypeOf<Props["badge"]>().toEqualTypeOf<ReactNode | undefined>();
    expectTypeOf<Props["features"]>().toEqualTypeOf<string[]>();
  });
});

describe("InferExternalProps (consumer-facing)", () => {
  it("requires undecorated props and relaxes optional()/default()", () => {
    expectTypeOf<External>().toMatchTypeOf<{
      required: string;
      plan: "monthly" | "yearly";
      product: PaywallProduct;
      features: string[];
    }>();
    // .optional() and .default() props may be omitted by consumers.
    expectTypeOf<{
      required: string;
      plan: "monthly" | "yearly";
      product: PaywallProduct;
      features: string[];
    }>().toMatchTypeOf<External>();
  });
});

describe("InferActions", () => {
  it("types payloads from the declared shape", () => {
    expectTypeOf<Actions["onSelect"]>().toEqualTypeOf<
      (payload: { productId: string; index: number }) => void
    >();
    expectTypeOf<Actions["onDismiss"]>().toEqualTypeOf<() => void>();
  });

  it("exposes consumer handler props under the action names", () => {
    expectTypeOf<ComponentProps["onSelect"]>().toEqualTypeOf<
      ((payload: { productId: string; index: number }) => void) | undefined
    >();
    expectTypeOf<ComponentProps["onDismiss"]>().toEqualTypeOf<(() => void) | undefined>();
    expectTypeOf<ComponentProps["children"]>().toEqualTypeOf<ReactNode | undefined>();
  });
});

describe("defineComponent end-to-end typing", () => {
  it("types the render context and the produced component", () => {
    const definition = defineComponent({
      props: () => propMap,
      actions: () => actionMap,
      render: ({ props, actions }) => {
        expectTypeOf(props.required).toEqualTypeOf<string>();
        expectTypeOf(props.optional).toEqualTypeOf<number | undefined>();
        expectTypeOf(props.defaulted).toEqualTypeOf<boolean>();
        expectTypeOf(actions.onSelect).toEqualTypeOf<
          (payload: { productId: string; index: number }) => void
        >();
        return null;
      },
    });

    expectTypeOf(definition.component).parameter(0).toEqualTypeOf<ComponentProps>();
  });
});

describe("PaywallStyle subset", () => {
  it("PAYWALL_STYLE_KEY_LIST covers every PaywallStyle key", () => {
    type Listed = (typeof PAYWALL_STYLE_KEY_LIST)[number];
    expectTypeOf<Exclude<keyof PaywallStyle, Listed>>().toEqualTypeOf<never>();
    expectTypeOf<Exclude<Listed, keyof PaywallStyle>>().toEqualTypeOf<never>();
  });

  it("rejects arbitrary CSS keys", () => {
    // @ts-expect-error transform is not part of the §3.1 subset
    const bad: PaywallStyle = { transform: "scale(2)" };
    void bad;
  });
});
