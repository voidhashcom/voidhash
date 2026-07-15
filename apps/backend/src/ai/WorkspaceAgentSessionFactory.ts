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

import { buildDesignerContext } from "./DesignerContext.ts";
import { registeredSkillSource } from "./skills/registry.ts";
import { designerAgentSystemPrompt } from "./surfaces.ts";
import { AgentEditSessionTracker, makeWorkspaceAgentTools } from "./WorkspaceAgentTools.ts";
import type { WorkspaceToolDeps } from "./workspace-tools.ts";

/** Services resolved by the Pi agent's in-process tools. */
export type WorkspaceAgentDeps = WorkspaceToolDeps | PaywallService;

/** Model and runtime configuration for the shared workspace session factory. */
export interface WorkspaceAgentSessionFactoryOptions<ConnectionData> {
  readonly defaultModel: Model<string>;
  readonly visionModel: Model<string>;
  readonly streamFn?: StreamFn;
  readonly getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;
  readonly runEffect: EffectRunner<ConnectionData, WorkspaceAgentDeps>;
  readonly resolveModel?: (
    provider: string,
    modelId: string,
    connectionData: ConnectionData,
  ) => Model<string> | undefined | Promise<Model<string> | undefined>;
}

const messageHasImage = (message: AgentMessage): boolean =>
  message.role === "user" &&
  Array.isArray(message.content) &&
  message.content.some((content) => content.type === "image");

const latestUserHasImage = (messages: ReadonlyArray<AgentMessage>): boolean => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user") return messageHasImage(message);
  }
  return false;
};

const skillPrompt = (): string => {
  const disclosure = renderSkillDisclosure(registeredSkillSource());
  return disclosure.length === 0
    ? ""
    : `\n\nCall \`read_skill\` before work covered by a listed skill.\n${disclosure}`;
};

const contextSystemPrompt = async <ConnectionData>(
  input: Pick<
    AgentSessionFactoryInput<ConnectionData>,
    "owner" | "connectionData" | "dynamicContext"
  >,
  runEffect: WorkspaceAgentSessionFactoryOptions<ConnectionData>["runEffect"],
): Promise<string> => {
  const resolved = await runEffect(
    input.connectionData,
    buildDesignerContext({
      projectId: input.owner.projectId,
      paywallId: input.dynamicContext.current.paywallId,
      selectedNodeIds: input.dynamicContext.current.selectedNodeIds,
    }),
  );
  return `${designerAgentSystemPrompt(resolved)}${skillPrompt()}`;
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

  return {
    create: async (input) => {
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
      let agent: Agent;
      agent = new Agent({
        initialState: {
          model: options.defaultModel,
          messages: [...input.messages],
          systemPrompt: await contextSystemPrompt(input, options.runEffect),
          tools,
        },
        ...(options.streamFn === undefined ? {} : { streamFn: options.streamFn }),
        ...(options.getApiKey === undefined ? {} : { getApiKey: options.getApiKey }),
        sessionId: input.sessionId,
        steeringMode: "all",
        followUpMode: "all",
        toolExecution: "sequential",
        afterToolCall: async ({ result }) => effectAgentToolErrorOverride(result),
        prepareNextTurnWithContext: async ({ context: piContext }) => {
          const systemPrompt = await contextSystemPrompt(input, options.runEffect);
          return {
            context: { ...piContext, systemPrompt },
            model: latestUserHasImage(piContext.messages)
              ? options.visionModel
              : preferredTextModel(agent),
          };
        },
      });
      preferredTextModels.set(agent, options.defaultModel);
      return agent;
    },
    preparePrompt: async ({ agent, message, owner, connectionData, dynamicContext }) => {
      agent.state.systemPrompt = await contextSystemPrompt(
        { owner, connectionData, dynamicContext },
        options.runEffect,
      );
      const textModel = preferredTextModel(agent);
      agent.state.model = messageHasImage(message) ? options.visionModel : textModel;
    },
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
