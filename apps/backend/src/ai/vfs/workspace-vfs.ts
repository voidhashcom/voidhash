/**
 * The workspace virtual filesystem the `bash` tool executes over: read-only
 * projections of the project's paywall workspace mounted over a writable
 * in-memory base (`/README.md`, `/tmp`, `/home/user`).
 *
 * Layout:
 *
 * - `/paywalls/<paywallId>/document.json` — cleaned document JSON (the same
 *   shape `get_paywall` returns).
 * - `/paywalls/<paywallId>/components/<name>.tsx` — local code-component TSX.
 *
 * Adding a future folder (`/builtins`, `/components` catalog, `/examples`) is
 * one new {@link ReadOnlyDirProvider} plus one mount entry in
 * {@link makeWorkspaceVfs}.
 */
import { serializeDocument, type SnapshotDocumentNode } from "@voidhash/ai-shared";
import { fileNameFromDocRelative } from "@voidhash/paywall-workspace";
import { InMemoryFs, MountableFs, type IFileSystem } from "just-bash/browser";

import {
  LazyReadOnlyFs,
  type ReadOnlyDirEntry,
  type ReadOnlyDirProvider,
} from "./readonly-fs.ts";

/** One paywall of the scoped project, as listed by the workspace service. */
export interface WorkspaceVfsPaywall {
  readonly slug: string;
  readonly paywallId: string;
}

/** The projected files of one paywall directory. */
export interface PaywallVfsFiles {
  readonly documentJson: string;
  readonly components: ReadonlyArray<{ readonly fileName: string; readonly source: string }>;
}

/**
 * The data the VFS reads, as plain promise-returning functions so the VFS
 * modules stay Effect-free and unit-testable with fixtures. `readPaywall`
 * returns `null` for an unknown id (e.g. a paywall deleted mid-call).
 */
export interface WorkspaceVfsSources {
  listPaywalls(): Promise<ReadonlyArray<WorkspaceVfsPaywall>>;
  readPaywall(paywallId: string): Promise<PaywallVfsFiles | null>;
}

/**
 * Shape a decoded document root into its VFS files: pretty-printed cleaned
 * document JSON plus the local `codeComponent` sources (walked from the
 * singleton `library` node) named by their `<name>.tsx` file basename.
 */
export const paywallVfsFiles = (root: SnapshotDocumentNode | null): PaywallVfsFiles => {
  const cleaned = root === null ? null : serializeDocument([root]);
  const library = (root?.children ?? []).find((child) => child.type === "library");
  const components = (library?.children ?? []).flatMap((node) => {
    if (node.type !== "codeComponent") {
      return [];
    }
    const data = (node.data ?? {}) as { path?: unknown; source?: unknown };
    return typeof data.path === "string" && typeof data.source === "string"
      ? [{ fileName: fileNameFromDocRelative(data.path), source: data.source }]
      : [];
  });
  return { documentJson: `${JSON.stringify(cleaned, null, 2)}\n`, components };
};

const COMPONENTS_DIR = "components";
const DOCUMENT_FILE = "document.json";

/**
 * `/paywalls` provider: one directory per paywall id. The listing and each
 * paywall's files are memoized per instance (= per bash invocation), so a
 * `grep -r /paywalls` reads every document exactly once. Ids not present in
 * the project listing resolve to ENOENT without touching `readPaywall` — the
 * listing is the project-scope gate.
 */
export class PaywallsProvider implements ReadOnlyDirProvider {
  private listing: Promise<ReadonlyArray<WorkspaceVfsPaywall>> | undefined;
  private readonly files = new Map<string, Promise<PaywallVfsFiles | null>>();

  constructor(private readonly sources: WorkspaceVfsSources) {}

  private list(): Promise<ReadonlyArray<WorkspaceVfsPaywall>> {
    this.listing ??= this.sources.listPaywalls();
    return this.listing;
  }

  private async filesOf(paywallId: string): Promise<PaywallVfsFiles | null> {
    const listed = (await this.list()).some((paywall) => paywall.paywallId === paywallId);
    if (!listed) {
      return null;
    }
    let files = this.files.get(paywallId);
    if (files === undefined) {
      files = this.sources.readPaywall(paywallId);
      this.files.set(paywallId, files);
    }
    return files;
  }

  async readdir(relPath: string): Promise<ReadonlyArray<ReadOnlyDirEntry> | null> {
    const segments = relPath === "" ? [] : relPath.split("/");
    if (segments.length === 0) {
      const paywalls = await this.list();
      return paywalls.map((paywall) => ({ name: paywall.paywallId, kind: "dir" }));
    }
    if (segments.length === 1) {
      const files = await this.filesOf(segments[0]!);
      return files === null
        ? null
        : [
            { name: DOCUMENT_FILE, kind: "file" },
            { name: COMPONENTS_DIR, kind: "dir" },
          ];
    }
    if (segments.length === 2 && segments[1] === COMPONENTS_DIR) {
      const files = await this.filesOf(segments[0]!);
      return files === null
        ? null
        : files.components.map((component) => ({ name: component.fileName, kind: "file" }));
    }
    return null;
  }

  async stat(relPath: string): Promise<{ kind: "file" | "dir"; size?: number } | null> {
    const segments = relPath === "" ? [] : relPath.split("/");
    if (segments.length === 0) {
      return { kind: "dir" };
    }
    if (segments.length === 1) {
      return (await this.filesOf(segments[0]!)) === null ? null : { kind: "dir" };
    }
    if (segments.length === 2) {
      const files = await this.filesOf(segments[0]!);
      if (files === null) {
        return null;
      }
      if (segments[1] === DOCUMENT_FILE) {
        return { kind: "file", size: new TextEncoder().encode(files.documentJson).length };
      }
      return segments[1] === COMPONENTS_DIR ? { kind: "dir" } : null;
    }
    if (segments.length === 3 && segments[1] === COMPONENTS_DIR) {
      const source = await this.componentSource(segments[0]!, segments[2]!);
      return source === null
        ? null
        : { kind: "file", size: new TextEncoder().encode(source).length };
    }
    return null;
  }

  async readFile(relPath: string): Promise<string | null> {
    const segments = relPath === "" ? [] : relPath.split("/");
    if (segments.length === 2 && segments[1] === DOCUMENT_FILE) {
      const files = await this.filesOf(segments[0]!);
      return files === null ? null : files.documentJson;
    }
    if (segments.length === 3 && segments[1] === COMPONENTS_DIR) {
      return this.componentSource(segments[0]!, segments[2]!);
    }
    return null;
  }

  private async componentSource(paywallId: string, fileName: string): Promise<string | null> {
    const files = await this.filesOf(paywallId);
    const component = files?.components.find((candidate) => candidate.fileName === fileName);
    return component?.source ?? null;
  }
}

export const WORKSPACE_VFS_README = `# Voidhash workspace (read-only projection)

Layout:
  /paywalls/<paywallId>/document.json          cleaned document JSON (same shape as get_paywall)
  /paywalls/<paywallId>/components/<name>.tsx  local code-component TSX sources
  /tmp                                         writable scratch — lives only within this single bash call

Directory names under /paywalls are paywall ids: pass them directly to begin_paywall_edit.
Run \`voidhash paywalls\` for an id → slug listing.

Everything except /tmp and /home/user is READ-ONLY (writes fail with EROFS). Each bash call is
a fresh shell and filesystem — chain steps with && and pipes instead of relying on state.
To modify a paywall, use begin_paywall_edit + edit_paywall / write_component.
`;

/**
 * Build the per-call workspace filesystem: a writable in-memory base carrying
 * `/README.md` and the scratch dirs, with the read-only `/paywalls` projection
 * mounted over it.
 */
export const makeWorkspaceVfs = async (sources: WorkspaceVfsSources): Promise<IFileSystem> => {
  const base = new InMemoryFs({ "/README.md": WORKSPACE_VFS_README });
  const fs = new MountableFs({
    base,
    mounts: [
      {
        mountPoint: "/paywalls",
        filesystem: new LazyReadOnlyFs(new PaywallsProvider(sources), {
          pathPrefix: "/paywalls",
        }),
      },
    ],
  });
  await fs.mkdir("/tmp");
  await fs.mkdir("/home/user", { recursive: true });
  return fs;
};
