import {
  Agent,
  bindEffectRunner,
  effectAgentToolErrorOverride,
  makeReadSkillTool,
  renderSkillDisclosure,
  type AgentMessage,
  type AgentSessionFactory,
  type AgentSessionFactoryInput,
  type EffectRunner,
  type Model,
  type StreamFn,
} from "@voidhash/agent";
import { PaywallService } from "@voidhash/core/services";
import { pick } from "@voidhash/lib/lang";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { runPromise } from "../runtime-boundary.ts";

import { buildDesignerContext } from "./DesignerContext.ts";
import { registeredSkillSource } from "./skills/registry.ts";
import { designerAgentSystemPrompt } from "./surfaces.ts";
import { AgentEditSessionTracker, makeWorkspaceAgentTools } from "./WorkspaceAgentTools.ts";
import type { WorkspaceToolDeps } from "./workspace-tools.ts";
import * as Str from "effect/String";
import * as Schema from "effect/Schema";

/** Services resolved by the Pi agent's in-process tools. */
export type WorkspaceAgentDeps = WorkspaceToolDeps | PaywallService;

/** Model and runtime configuration for the shared workspace session factory. */
export interface WorkspaceAgentSessionFactoryOptions<ConnectionData> {
  readonly defaultModel: Model<string>;
  readonly visionModel: Model<string>;
  readonly streamFn?: StreamFn;
  readonly getApiKey?: (
    provider: string,
  ) => Promise<string | typeof Schema.Undefined.Type> | string | typeof Schema.Undefined.Type;
  readonly runEffect: EffectRunner<ConnectionData, WorkspaceAgentDeps>;
  readonly resolveModel?: (
    provider: string,
    modelId: string,
    connectionData: ConnectionData,
  ) =>
    | Model<string>
    | typeof Schema.Undefined.Type
    | Promise<Model<string> | typeof Schema.Undefined.Type>;
}

const messageHasImage = (message: AgentMessage): boolean =>
  message.role === "user" &&
  Array.isArray(message.content) &&
  message.content.some((content) => content.type === "image");

const latestUserHasImage = (messages: ReadonlyArray<AgentMessage>): boolean => {
  return Option.exists(
    Arr.findLast(messages, (message) => message.role === "user"),
    messageHasImage,
  );
};

const skillPrompt = (): string => {
  const disclosure = renderSkillDisclosure(registeredSkillSource());
  if (Str.isEmpty(disclosure)) return "";
  return `\n\nCall \`read_skill\` before work covered by a listed skill.\n${disclosure}`;
};

const contextSystemPrompt = <ConnectionData>(
  input: Pick<
    AgentSessionFactoryInput<ConnectionData>,
    "owner" | "connectionData" | "dynamicContext"
  >,
  runEffect: WorkspaceAgentSessionFactoryOptions<ConnectionData>["runEffect"],
): Promise<string> =>
  runEffect(
    input.connectionData,
    buildDesignerContext({
      projectId: input.owner.projectId,
      paywallId: input.dynamicContext.current.paywallId,
      selectedNodeIds: input.dynamicContext.current.selectedNodeIds,
    }),
  ).then((resolved) => `${designerAgentSystemPrompt(resolved)}${skillPrompt()}`);

/** Spreads `streamFn` only when the host supplied one, leaving the Pi default otherwise. */
const optionalStreamFn = (
  streamFn: StreamFn | typeof Schema.Undefined.Type,
): { streamFn?: StreamFn } => {
  if (streamFn === undefined) return {};
  return { streamFn };
};

type GetApiKey = NonNullable<WorkspaceAgentSessionFactoryOptions<unknown>["getApiKey"]>;

/** Spreads `getApiKey` only when the host supplied one. */
const optionalGetApiKey = (
  getApiKey: GetApiKey | typeof Schema.Undefined.Type,
): { getApiKey?: GetApiKey } => {
  if (getApiKey === undefined) return {};
  return { getApiKey };
};

/**
 * Creates Pi agents that run canonical workspace tools through the host Effect
 * runner and refresh designer facts before every provider turn.
 */
export const makeWorkspaceAgentSessionFactory = <ConnectionData>(
  options: WorkspaceAgentSessionFactoryOptions<ConnectionData>,
): AgentSessionFactory<ConnectionData> => {
  const preferredTextModels = new WeakMap<Agent, Model<string>>();
  const isVisionModel = (model: Model<string>): boolean =>
    model.provider === options.visionModel.provider && model.id === options.visionModel.id;
  const preferredTextModel = (agent: Agent): Model<string> => {
    if (!isVisionModel(agent.state.model)) {
      preferredTextModels.set(agent, agent.state.model);
    }
    return preferredTextModels.get(agent) ?? options.defaultModel;
  };

  const turnModel = (messages: ReadonlyArray<AgentMessage>, agent: Agent): Model<string> => {
    if (latestUserHasImage(messages)) return options.visionModel;
    return preferredTextModel(agent);
  };

  return {
    create: (input) => {
      const editSessions = new AgentEditSessionTracker();
      editSessions.rehydrate(input.messages);
      const runEffect = bindEffectRunner(options.runEffect, input.connectionData);
      const tools = [
        ...makeWorkspaceAgentTools(
          { projectId: input.owner.projectId, agentSessionId: input.sessionId },
          runEffect,
          editSessions,
        ),
        makeReadSkillTool(registeredSkillSource()),
      ];
      return contextSystemPrompt(input, options.runEffect).then((systemPrompt) => {
        let agent: Agent;
        agent = new Agent({
          initialState: {
            model: options.defaultModel,
            messages: [...input.messages],
            systemPrompt,
            tools,
          },
          ...optionalStreamFn(options.streamFn),
          ...optionalGetApiKey(options.getApiKey),
          sessionId: input.sessionId,
          steeringMode: "all",
          followUpMode: "all",
          toolExecution: "sequential",
          afterToolCall: ({ result }) =>
            runPromise(Effect.sync(() => effectAgentToolErrorOverride(result) ?? undefined)),
          prepareNextTurnWithContext: ({ context: piContext }) =>
            contextSystemPrompt(input, options.runEffect).then((nextSystemPrompt) => ({
              context: { ...piContext, systemPrompt: nextSystemPrompt },
              model: turnModel(piContext.messages, agent),
            })),
        });
        preferredTextModels.set(agent, options.defaultModel);
        return agent;
      });
    },
    preparePrompt: ({ agent, message, owner, connectionData, dynamicContext }) =>
      contextSystemPrompt({ owner, connectionData, dynamicContext }, options.runEffect).then(
        (systemPrompt) => {
          agent.state.systemPrompt = systemPrompt;
          const textModel = preferredTextModel(agent);
          agent.state.model = pick(messageHasImage(message), options.visionModel, textModel);
        },
      ),
    resolveModel: (provider, modelId, connectionData) => {
      if (provider === options.defaultModel.provider && modelId === options.defaultModel.id) {
        return options.defaultModel;
      }
      if (provider === options.visionModel.provider && modelId === options.visionModel.id) {
        return options.visionModel;
      }
      return options.resolveModel?.(provider, modelId, connectionData);
    },
  };
};
