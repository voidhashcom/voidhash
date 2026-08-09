import { Context, Effect } from "effect";
import { Type } from "typebox";
import { describe, expect, it } from "vitest";

import {
  effectAgentToolErrorOverride,
  makeEffectAgentTool,
  makeEffectAgentToolWithRunner,
  type EffectAgentToolResult,
} from "../src/AgentToolAdapter.ts";

class PrefixService extends Context.Service<PrefixService, { readonly prefix: string }>()(
  "test/PrefixService",
) {}
const Parameters = Type.Object({ value: Type.String() });

describe("makeEffectAgentTool", () => {
  it("runs a handler against the captured Effect context", () =>
    Effect.runPromise(
      Effect.gen(function* () {
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
                const result: EffectAgentToolResult<{ readonly length: number }> = {
                  content: [{ type: "text", text }],
                  details: { length: text.length },
                };
                return result;
              }),
          },
          context,
        );

        const result = yield* Effect.promise(() => tool.execute("call-1", { value: "ok" }));
        expect(result).toEqual({
          content: [{ type: "text", text: "captured:ok" }],
          details: { length: 11 },
        });
      }),
    ));

  it("preserves structured error details for Pi's after-tool hook", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const tool = makeEffectAgentTool<{ readonly value: string }, undefined, never, never>(
          {
            name: "fail",
            description: "Fail",
            parameters: Parameters,
            effectHandler: () =>
              Effect.succeed({
                content: [{ type: "text", text: "workspace rejected the edit" }],
                details: undefined,
                isError: true,
              }),
          },
          Context.empty(),
        );

        const result = yield* Effect.promise(() => tool.execute("call-1", { value: "bad" }));
        expect(result).toEqual({
          content: [{ type: "text", text: "workspace rejected the edit" }],
          details: undefined,
        });
        expect(effectAgentToolErrorOverride(result)).toEqual({ isError: true });
      }),
    ));

  it("acquires the Effect context lazily for each tool execution", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        let execution = 0;
        const tool = makeEffectAgentToolWithRunner<
          { readonly value: string },
          undefined,
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
                const result: EffectAgentToolResult<undefined> = {
                  content: [{ type: "text", text: `${service.prefix}${value}` }],
                  details: undefined,
                };
                return result;
              }),
          },
          (effect) => {
            execution += 1;
            return Effect.runPromise(
              effect.pipe(Effect.provide(Context.make(PrefixService, { prefix: `${execution}:` }))),
            );
          },
        );

        const first = yield* Effect.promise(() => tool.execute("call-1", { value: "first" }));
        expect(first).toMatchObject({ content: [{ type: "text", text: "1:first" }] });
        const second = yield* Effect.promise(() => tool.execute("call-2", { value: "second" }));
        expect(second).toMatchObject({ content: [{ type: "text", text: "2:second" }] });
      }),
    ));
});
