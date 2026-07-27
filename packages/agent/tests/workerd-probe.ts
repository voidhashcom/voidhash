import { Agent, type AgentTool, type StreamFn } from "@earendil-works/pi-agent-core";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type Model,
} from "@earendil-works/pi-ai";
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

const response = (content: AssistantMessage["content"], stopReason: "stop" | "toolUse") => ({
  role: "assistant" as const,
  content,
  api: model.api,
  provider: model.provider,
  model: model.id,
  usage,
  stopReason,
  timestamp: Date.now(),
});

const streamFn: StreamFn = (_model, context) => {
  const stream = createAssistantMessageEventStream();
  const hasToolResult = context.messages.some((message) => message.role === "toolResult");
  const message = hasToolResult
    ? response([{ type: "text", text: "workerd-compatible" }], "stop")
    : response(
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
  queueMicrotask(() => {
    stream.push({ type: "start", partial: { ...message, content: [] } });
    stream.push({ type: "done", reason: message.stopReason, message });
  });
  return stream;
};

const Parameters = Type.Object({ value: Type.String() });
const tool: AgentTool<typeof Parameters> = {
  name: "probe",
  label: "Probe",
  description: "Workerd tool probe",
  parameters: Parameters,
  execute: async (_toolCallId, input) => ({
    content: [{ type: "text", text: input.value }],
    details: { value: input.value },
  }),
};

export default {
  async fetch(): Promise<Response> {
    const agent = new Agent({
      initialState: { model, systemPrompt: "probe", tools: [tool] },
      streamFn,
    });
    await agent.prompt("run");
    const compatible = agent.state.messages.some(
      (message) =>
        message.role === "assistant" &&
        message.content.some(
          (content) => content.type === "text" && content.text === "workerd-compatible",
        ),
    );
    return Response.json({ compatible, messageCount: agent.state.messages.length });
  },
};
