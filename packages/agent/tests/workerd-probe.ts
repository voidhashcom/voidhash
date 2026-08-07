import { Agent, type AgentTool, type StreamFn } from "@earendil-works/pi-agent-core";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type Model,
} from "@earendil-works/pi-ai";
import { Clock, Effect } from "effect";
import { Type } from "typebox";

const model: Model<string> = {
  id: "workerd-probe",
  name: "workerd-probe",
  api: "workerd-probe",
  provider: "workerd-probe",
  baseUrl: "",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 1_000,
  maxTokens: 100,
};

const usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

type ProbeResponse = AssistantMessage & { readonly stopReason: "stop" | "toolUse" };

const response = (
  content: AssistantMessage["content"],
  stopReason: "stop" | "toolUse",
): ProbeResponse => ({
  role: "assistant",
  content,
  api: model.api,
  provider: model.provider,
  model: model.id,
  usage,
  stopReason,
  timestamp: Effect.runSync(Clock.currentTimeMillis),
});

const probeResponse = (hasToolResult: boolean): ProbeResponse => {
  if (hasToolResult) return response([{ type: "text", text: "workerd-compatible" }], "stop");
  return response(
    [
      {
        type: "toolCall",
        id: "probe-call",
        name: "probe",
        arguments: { value: "ok" },
      },
    ],
    "toolUse",
  );
};

const streamFn: StreamFn = (_model, context) => {
  const stream = createAssistantMessageEventStream();
  const message = probeResponse(
    context.messages.some((entry) => entry.role === "toolResult"),
  );
  Effect.runFork(
    Effect.sync(() => {
      stream.push({ type: "start", partial: { ...message, content: [] } });
      stream.push({ type: "done", reason: message.stopReason, message });
    }).pipe(Effect.delay("0 millis")),
  );
  return stream;
};

const Parameters = Type.Object({ value: Type.String() });
const tool: AgentTool<typeof Parameters> = {
  name: "probe",
  label: "Probe",
  description: "Workerd tool probe",
  parameters: Parameters,
  execute: (_toolCallId, input) =>
    Effect.runPromise(
      Effect.succeed({
        content: [{ type: "text", text: input.value }],
        details: { value: input.value },
      }),
    ),
};

export default {
  fetch(): Promise<Response> {
    return Effect.runPromise(
      Effect.gen(function* () {
        const agent = new Agent({
          initialState: { model, systemPrompt: "probe", tools: [tool] },
          streamFn,
        });
        yield* Effect.promise(() => agent.prompt("run"));
        const compatible = agent.state.messages.some(
          (message) =>
            message.role === "assistant" &&
            message.content.some(
              (content) => content.type === "text" && content.text === "workerd-compatible",
            ),
        );
        return Response.json({ compatible, messageCount: agent.state.messages.length });
      }),
    );
  },
};
