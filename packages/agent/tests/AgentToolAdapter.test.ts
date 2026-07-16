import { Context, Effect } from "effect";
import { Type } from "typebox";
import { describe, expect, it } from "vitest";

import {
  effectAgentToolErrorOverride,
  makeEffectAgentTool,
  makeEffectAgentToolWithRunner,
} from "../src/AgentToolAdapter.ts";

class PrefixService extends Context.Service<PrefixService, { readonly prefix: string }>()(
  "test/PrefixService",
) {}
const Parameters = Type.Object({ value: Type.String() });

describe("makeEffectAgentTool", () => {
  it("runs a handler against the captured Effect context", async () => {
    const context = Context.make(PrefixService, { prefix: "captured:" });
    const tool = makeEffectAgentTool<
      { readonly value: string },
      { readonly length: number },
      never,
      PrefixService
    >(
      {
        name: "echo",
        description: "Echo a value",
        parameters: Parameters,
        effectHandler: ({ value }) =>
          Effect.gen(function* () {
            const service = yield* PrefixService;
            const text = `${service.prefix}${value}`;
            return {
              content: [{ type: "text", text }],
              details: { length: text.length },
            };
          }),
      },
      context,
    );

    await expect(tool.execute("call-1", { value: "ok" })).resolves.toEqual({
      content: [{ type: "text", text: "captured:ok" }],
      details: { length: 11 },
    });
  });

  it("preserves structured error details for Pi's after-tool hook", async () => {
    const tool = makeEffectAgentTool<{ readonly value: string }, never, never, never>(
      {
        name: "fail",
        description: "Fail",
        parameters: Parameters,
        effectHandler: () =>
          Effect.succeed({
            content: [{ type: "text", text: "workspace rejected the edit" }],
            details: undefined as never,
            isError: true,
          }),
      },
      Context.empty(),
    );

    const result = await tool.execute("call-1", { value: "bad" });
    expect(result).toEqual({
      content: [{ type: "text", text: "workspace rejected the edit" }],
      details: undefined,
    });
    expect(effectAgentToolErrorOverride(result)).toEqual({ isError: true });
  });

  it("acquires the Effect context lazily for each tool execution", async () => {
    let execution = 0;
    const tool = makeEffectAgentToolWithRunner<
      { readonly value: string },
      never,
      never,
      PrefixService
    >(
      {
        name: "echo",
        description: "Echo a value",
        parameters: Parameters,
        effectHandler: ({ value }) =>
          Effect.gen(function* () {
            const service = yield* PrefixService;
            return {
              content: [{ type: "text" as const, text: `${service.prefix}${value}` }],
              details: undefined as never,
            };
          }),
      },
      (effect) => {
        execution += 1;
        return Effect.runPromise(
          effect.pipe(Effect.provide(Context.make(PrefixService, { prefix: `${execution}:` }))),
        );
      },
    );

    await expect(tool.execute("call-1", { value: "first" })).resolves.toMatchObject({
      content: [{ type: "text", text: "1:first" }],
    });
    await expect(tool.execute("call-2", { value: "second" })).resolves.toMatchObject({
      content: [{ type: "text", text: "2:second" }],
    });
  });
});
