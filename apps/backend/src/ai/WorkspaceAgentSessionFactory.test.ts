import { makeLayerEffectRunner } from "@voidhash/agent";
import { Context, Layer } from "effect";
import { describe, expect, it } from "vite-plus/test";

import type { WorkspaceAgentDeps } from "./WorkspaceAgentSessionFactory.ts";
import { makeWorkspaceAgentSessionFactory } from "./WorkspaceAgentSessionFactory.ts";
import { workspaceTextModel, workspaceVisionModel } from "./WorkspaceAgentModels.ts";

describe("makeWorkspaceAgentSessionFactory", () => {
  it("uses progressive skill disclosure and switches to vision only for image turns", async () => {
    const factory = makeWorkspaceAgentSessionFactory<void>({
      defaultModel: workspaceTextModel,
      visionModel: workspaceVisionModel,
      runEffect: makeLayerEffectRunner<void, WorkspaceAgentDeps>(() =>
        Layer.succeedContext(Context.empty() as Context.Context<WorkspaceAgentDeps>),
      ),
    });
    const dynamicContext = { current: { selectedNodeIds: [] } };
    const owner = {
      organizationId: "organization-1",
      projectId: "project-1",
      userId: "user-1",
    };
    const agent = await factory.create({
      sessionId: "session-1",
      owner,
      connectionData: undefined,
      messages: [],
      dynamicContext,
    });

    expect(agent.state.systemPrompt).toContain("<name>paywall-authoring</name>");
    expect(agent.state.systemPrompt).not.toContain("Document model and authorable tree");
    expect(agent.state.tools.map((tool) => tool.name)).toContain("read_skill");
    expect(agent.state.tools.map((tool) => tool.name)).toContain("edit_paywall");
    const editPaywall = agent.state.tools.find((tool) => tool.name === "edit_paywall");
    expect(editPaywall?.parameters.properties).not.toHaveProperty("changeSetId");

    await factory.preparePrompt?.({
      agent,
      sessionId: "session-1",
      owner,
      connectionData: undefined,
      dynamicContext,
      message: { role: "user", content: "text", timestamp: 1 },
    });
    expect(agent.state.model.id).toBe(workspaceTextModel.id);

    await factory.preparePrompt?.({
      agent,
      sessionId: "session-1",
      owner,
      connectionData: undefined,
      dynamicContext,
      message: {
        role: "user",
        content: [{ type: "image", data: "image", mimeType: "image/png" }],
        timestamp: 2,
      },
    });
    expect(agent.state.model.id).toBe(workspaceVisionModel.id);

    const selectedModel = { ...workspaceTextModel, id: "selected-model", name: "Selected" };
    agent.state.model = selectedModel;
    await factory.preparePrompt?.({
      agent,
      sessionId: "session-1",
      owner,
      connectionData: undefined,
      dynamicContext,
      message: { role: "user", content: "text", timestamp: 3 },
    });
    expect(agent.state.model.id).toBe(selectedModel.id);

    await factory.preparePrompt?.({
      agent,
      sessionId: "session-1",
      owner,
      connectionData: undefined,
      dynamicContext,
      message: {
        role: "user",
        content: [{ type: "image", data: "image", mimeType: "image/png" }],
        timestamp: 4,
      },
    });
    await factory.preparePrompt?.({
      agent,
      sessionId: "session-1",
      owner,
      connectionData: undefined,
      dynamicContext,
      message: { role: "user", content: "text", timestamp: 5 },
    });
    expect(agent.state.model.id).toBe(selectedModel.id);
  });
});
