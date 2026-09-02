export { Agent } from "@earendil-works/pi-agent-core";
import type { Model } from "@earendil-works/pi-ai";
import { ANTHROPIC_MODELS } from "@earendil-works/pi-ai/providers/anthropic.models";
import { CLOUDFLARE_WORKERS_AI_MODELS } from "@earendil-works/pi-ai/providers/cloudflare-workers-ai.models";
import { OPENAI_MODELS } from "@earendil-works/pi-ai/providers/openai.models";
import * as P from "effect/Predicate";
import * as Option from "effect/Option";
export { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
export type { AssistantMessage, ToolCall } from "@earendil-works/pi-ai";
export type { AgentEvent, AgentMessage, AgentTool, StreamFn } from "@earendil-works/pi-agent-core";
export type { AssistantMessageEventStream, Model } from "@earendil-works/pi-ai";
export { Type } from "typebox";
export type { TSchema } from "typebox";

const providerCatalog = (provider: string): Option.Option<Record<string, unknown>> => {
  if (provider === "openai") return Option.some(OPENAI_MODELS);
  if (provider === "anthropic") return Option.some(ANTHROPIC_MODELS);
  if (provider === "cloudflare-workers-ai") return Option.some(CLOUDFLARE_WORKERS_AI_MODELS);
  return Option.none();
};

/**
 * Pi's generated catalogs are plain literal objects whose `compat` field is
 * narrower than `Model<string>` allows, so entries are recognised structurally
 * rather than asserted.
 */
const isCatalogModel = (value: unknown): value is Model<string> =>
  P.isObject(value) && value !== null && "id" in value && "api" in value && "provider" in value;

/** Looks up a model in Pi's built-in catalog from runtime provider settings. */
export const getCatalogModel = (
  provider: string,
  modelId: string,
): Option.Option<Model<string>> => {
  const catalog = providerCatalog(provider);
  if (Option.isNone(catalog)) return Option.none();
  const entry = catalog.value[modelId];
  if (isCatalogModel(entry)) return Option.some(entry);
  return Option.none();
};

export * from "./AgentSessionCore.ts";
export * from "./AgentToolAdapter.ts";
export * from "./EffectRunner.ts";
export * from "./Protocol.ts";
export * from "./SessionLog.ts";
export * from "./SkillSource.ts";
