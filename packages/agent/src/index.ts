export { Agent } from "@earendil-works/pi-agent-core";
import type { Model } from "@earendil-works/pi-ai";
import { ANTHROPIC_MODELS } from "@earendil-works/pi-ai/providers/anthropic.models";
import { CLOUDFLARE_WORKERS_AI_MODELS } from "@earendil-works/pi-ai/providers/cloudflare-workers-ai.models";
import { OPENAI_MODELS } from "@earendil-works/pi-ai/providers/openai.models";
export { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
export type { AssistantMessage, ToolCall } from "@earendil-works/pi-ai";
export type { AgentEvent, AgentMessage, AgentTool, StreamFn } from "@earendil-works/pi-agent-core";
export type { AssistantMessageEventStream, Model } from "@earendil-works/pi-ai";
export { Type } from "typebox";
export type { TSchema } from "typebox";

/** Looks up a model in Pi's built-in catalog from runtime provider settings. */
export const getCatalogModel = (provider: string, modelId: string): Model<string> | undefined => {
  const catalog =
    provider === "openai"
      ? OPENAI_MODELS
      : provider === "anthropic"
        ? ANTHROPIC_MODELS
        : provider === "cloudflare-workers-ai"
          ? CLOUDFLARE_WORKERS_AI_MODELS
          : undefined;
  return catalog?.[modelId as keyof typeof catalog] as Model<string> | undefined;
};

export * from "./AgentSessionCore.ts";
export * from "./AgentToolAdapter.ts";
export * from "./EffectRunner.ts";
export * from "./Protocol.ts";
export * from "./SessionLog.ts";
export * from "./SkillSource.ts";
