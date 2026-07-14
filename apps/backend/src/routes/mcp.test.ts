import { describe, expect, it } from "vite-plus/test";

import { selectMcpProject } from "./mcp.ts";

const projects = [
  { id: "proj_1", slug: "alpha" },
  { id: "proj_2", slug: "beta" },
];

describe("selectMcpProject", () => {
  it("selects an authorized project by id or slug", () => {
    expect(selectMcpProject(projects, "proj_2")).toEqual({ ok: true, project: projects[1] });
    expect(selectMcpProject(projects, "alpha")).toEqual({ ok: true, project: projects[0] });
  });

  it("requires an explicit selector when a user has multiple projects", () => {
    expect(selectMcpProject(projects, undefined)).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("defaults only when exactly one project is accessible", () => {
    expect(selectMcpProject([projects[0]!], undefined)).toEqual({
      ok: true,
      project: projects[0],
    });
    expect(selectMcpProject([], undefined)).toMatchObject({ ok: false, status: 403 });
  });
});
