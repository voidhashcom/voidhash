import { describe, expect, it } from "vite-plus/test";

import { runWorkspaceBash, truncateBashOutput } from "./bash-tool.ts";
import type { PaywallVfsFiles, WorkspaceVfsSources } from "./workspace-vfs.ts";

/**
 * Fixture sources: two paywalls, `pw_1` with one local component. `readCalls`
 * counts document reads per paywall id so tests can assert the per-call
 * memoization and the listing scope gate.
 */
const fixtureSources = (): { sources: WorkspaceVfsSources; readCalls: Map<string, number> } => {
  const readCalls = new Map<string, number>();
  const paywalls: Record<string, PaywallVfsFiles> = {
    pw_1: {
      documentJson: `${JSON.stringify({ id: "root1", name: "Trial", token: "trial-token" }, null, 2)}\n`,
      components: [{ fileName: "hero.tsx", source: "export const Hero = () => null;\n" }],
    },
    pw_2: {
      documentJson: `${JSON.stringify({ id: "root2", name: "Onboarding" }, null, 2)}\n`,
      components: [],
    },
  };
  const sources: WorkspaceVfsSources = {
    listPaywalls: async () => [
      { paywallId: "pw_1", slug: "trial" },
      { paywallId: "pw_2", slug: "onboarding" },
    ],
    readPaywall: async (paywallId) => {
      readCalls.set(paywallId, (readCalls.get(paywallId) ?? 0) + 1);
      return paywalls[paywallId] ?? null;
    },
  };
  return { sources, readCalls };
};

describe("runWorkspaceBash", () => {
  it("lists the root with README, paywalls mount, and scratch dirs", async () => {
    const { sources } = fixtureSources();
    const result = await runWorkspaceBash(sources, "ls /");
    expect(result.exitCode).toBe(0);
    const names = result.stdout.trim().split("\n");
    expect(names).toContain("README.md");
    expect(names).toContain("paywalls");
    expect(names).toContain("tmp");
  });

  it("serves the README and the paywall projections", async () => {
    const { sources } = fixtureSources();
    const readme = await runWorkspaceBash(sources, "cat /README.md");
    expect(readme.stdout).toContain("/paywalls/<paywallId>/document.json");

    const listing = await runWorkspaceBash(sources, "ls /paywalls");
    expect(listing.stdout.trim().split("\n").sort()).toEqual(["pw_1", "pw_2"]);

    const document = await runWorkspaceBash(sources, "cat /paywalls/pw_1/document.json");
    expect(document.exitCode).toBe(0);
    expect(document.stdout).toContain("trial-token");

    const component = await runWorkspaceBash(
      sources,
      "cat /paywalls/pw_1/components/hero.tsx",
    );
    expect(component.stdout).toContain("export const Hero");
  });

  it("reads each paywall document exactly once per call under grep -r", async () => {
    const { sources, readCalls } = fixtureSources();
    const result = await runWorkspaceBash(
      sources,
      "grep -rl trial-token /paywalls && grep -c trial-token /paywalls/pw_1/document.json",
    );
    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stdout).toContain("/paywalls/pw_1/document.json");
    expect(readCalls.get("pw_1")).toBe(1);
    expect(readCalls.get("pw_2")).toBe(1);
  });

  it("refuses ids outside the project listing without reading them", async () => {
    const { sources, readCalls } = fixtureSources();
    const result = await runWorkspaceBash(sources, "cat /paywalls/pw_403/document.json");
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("No such file or directory");
    expect(readCalls.has("pw_403")).toBe(false);
  });

  it("rejects writes into the projection with EROFS but allows /tmp scratch", async () => {
    const { sources } = fixtureSources();
    const write = await runWorkspaceBash(sources, "echo x > /paywalls/pw_1/scratch.txt");
    expect(write.exitCode).not.toBe(0);
    expect(write.stderr).toContain("EROFS");

    const scratch = await runWorkspaceBash(
      sources,
      "echo scratch-ok > /tmp/x && cat /tmp/x",
    );
    expect(scratch.exitCode).toBe(0);
    expect(scratch.stdout).toBe("scratch-ok\n");
  });

  it("answers voidhash and voidhash paywalls", async () => {
    const { sources } = fixtureSources();
    const help = await runWorkspaceBash(sources, "voidhash");
    expect(help.stdout).toContain("read-only projection");

    const paywalls = await runWorkspaceBash(sources, "voidhash paywalls");
    expect(paywalls.stdout).toBe("pw_1\ttrial\npw_2\tonboarding\n");

    const unknown = await runWorkspaceBash(sources, "voidhash nope");
    expect(unknown.exitCode).toBe(1);
    expect(unknown.stderr).toContain("unknown subcommand");
  });
});

describe("truncateBashOutput", () => {
  it("passes short output through and truncates long output with a notice", () => {
    const short = truncateBashOutput({ stdout: "ok\n", stderr: "" });
    expect(short).toEqual({ stdout: "ok\n", stderr: "" });

    const long = truncateBashOutput({ stdout: "x".repeat(50_000), stderr: "y".repeat(9_000) });
    expect(long.stdout.length).toBeLessThan(41_000);
    expect(long.stdout).toContain("[stdout truncated at 40kB");
    expect(long.stderr).toContain("[stderr truncated at 8kB");
  });
});
