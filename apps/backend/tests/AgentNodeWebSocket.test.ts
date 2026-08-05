import { describe, expect, it } from "vite-plus/test";

import { parseAgentNodeRoute } from "../src/agent/AgentNodeWebSocket.ts";

describe("parseAgentNodeRoute", () => {
  it("parses a scoped durable session", () => {
    expect(
      parseAgentNodeRoute({
        url: "/api/agent/sessions/agent_1/ws?organizationId=org_1&projectId=project_1&surface=designer",
      }),
    ).toEqual({
      _tag: "Route",
      route: {
        organizationId: "org_1",
        projectId: "project_1",
        sessionId: "agent_1",
        surface: "designer",
      },
    });
  });

  it("separates unrelated upgrades from malformed agent routes", () => {
    expect(parseAgentNodeRoute({ url: "/ws/v1/documents/1" })).toEqual({ _tag: "Other" });
    expect(parseAgentNodeRoute({ url: "/api/agent/sessions/a/ws" })).toEqual({
      _tag: "Invalid",
    });
    expect(
      parseAgentNodeRoute({
        url: "/api/agent/sessions/a/ws?organizationId=o&projectId=p",
      }),
    ).toEqual({ _tag: "Invalid" });
    expect(
      parseAgentNodeRoute({
        url: "/api/agent/sessions/a/ws?organizationId=o&projectId=p&surface=unknown",
      }),
    ).toEqual({ _tag: "Invalid" });
    expect(
      parseAgentNodeRoute({
        url: `/api/agent/sessions/${"a".repeat(65)}/ws?organizationId=o&projectId=p&surface=designer`,
      }),
    ).toEqual({ _tag: "Invalid" });
  });
});
