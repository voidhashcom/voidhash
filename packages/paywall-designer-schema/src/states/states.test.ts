import { Document, Primitive } from "@voidhash/mimic";
import { describe, expect, test } from "vitest";

import {
	createStateSchemaWithStyleAndActionOverrides,
	createStateSchemaWithStyleOverrides,
} from "./states";

const baseCondition = {
	type: "or" as const,
	value: [
		{
			type: "and" as const,
			value: [
				{
					type: "equals" as const,
					value: {
						left: {
							type: "literal" as const,
							value: { key: "boolean" as const, value: true },
						},
						right: {
							type: "literal" as const,
							value: { key: "boolean" as const, value: true },
						},
					},
				},
			],
		},
	],
};

const testStyleSchema = Primitive.Struct({
	backgroundColor: Primitive.String().default("rgba(0, 0, 0, 1)"),
	width: Primitive.Number().default(100),
});

const stateWithStyleOverridesSchema = createStateSchemaWithStyleOverrides(
	testStyleSchema.partial({ stripDefaults: true }).default({}),
);

const stateWithStyleAndActionOverridesSchema =
	createStateSchemaWithStyleAndActionOverrides(
		testStyleSchema.partial({ stripDefaults: true }).default({}),
	);

describe("state schemas", () => {
	test("fills style overrides with defaults", () => {
		const doc = Document.make(stateWithStyleOverridesSchema);
		doc.transaction((root) => {
			root.condition.set(baseCondition);
			root.id.set("state-1");
			root.name.set("Hovered");
		});

		const snapshot = doc.toSnapshot()!;

		expect(snapshot.overrides?.style ?? {}).toEqual({});
	});

	test("fills style and action overrides with defaults", () => {
		const doc = Document.make(stateWithStyleAndActionOverridesSchema);
		doc.transaction((root) => {
			root.condition.set(baseCondition);
			root.id.set("state-1");
			root.name.set("Hovered");
		});

		const snapshot = doc.toSnapshot()!;
		expect(snapshot.overrides?.style ?? {}).toEqual({});
		expect(snapshot.overrides?.actions ?? []).toEqual([]);
	});

	test("accepts typed style override values", () => {
		const doc = Document.make(stateWithStyleOverridesSchema);
		doc.transaction((root) => {
			root.condition.set(baseCondition);
			root.id.set("state-1");
			root.name.set("Hovered");
			root.overrides.style.update({
				backgroundColor: "rgba(255, 0, 0, 1)",
				width: 240,
			});
		});

		const snapshot = doc.toSnapshot()!;
		const styleOverrides = (snapshot.overrides?.style ?? {}) as Record<
			string,
			unknown
		>;

		expect(styleOverrides.backgroundColor).toBe("rgba(255, 0, 0, 1)");
		expect(styleOverrides.width).toBe(240);
	});

	test("strips defaults from style overrides", () => {
		const doc = Document.make(stateWithStyleOverridesSchema);
		doc.transaction((root) => {
			root.condition.set(baseCondition);
			root.id.set("state-1");
			root.name.set("Hovered");
			root.overrides.style.update({ width: 240 });
			root.overrides.style.update({ width: undefined });
		});

		const snapshot = doc.toSnapshot()!;
		expect(snapshot.overrides?.style ?? {}).toEqual({});
	});

	test("ignores unknown style override keys", () => {
		const doc = Document.make(stateWithStyleOverridesSchema);
		doc.transaction((root) => {
			root.condition.set(baseCondition);
			root.id.set("state-1");
			root.name.set("Hovered");
			root.overrides.style.update({
				unknownKey: 123,
			} as never);
		});

		const snapshot = doc.toSnapshot()!;
		const styleOverrides = (snapshot.overrides?.style ?? {}) as Record<
			string,
			unknown
		>;

		expect(styleOverrides.unknownKey).toBeUndefined();
	});

	test("accepts action overrides", () => {
		const doc = Document.make(stateWithStyleAndActionOverridesSchema);
		doc.transaction((root) => {
			root.condition.set(baseCondition);
			root.id.set("state-1");
			root.name.set("Hovered");
			root.overrides.actions.push({
				action: { type: "none" },
				interactionId: "interaction-1",
			});
		});

		const snapshot = doc.toSnapshot()!;
		expect(snapshot.overrides?.actions?.[0]?.value?.action?.type).toBe("none");
	});
});
