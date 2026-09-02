import * as Schema from "effect/Schema";
import { unsafeDefined } from "../../runtime-boundary.ts";
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
import * as Effect from "effect/Effect";
import { runPromise } from "../../runtime-boundary.ts";
import * as Formatter from "effect/Formatter";
import { InMemoryFs, MountableFs, type IFileSystem } from "just-bash/browser";

import { LazyReadOnlyFs, type ReadOnlyDirEntry, type ReadOnlyDirProvider } from "./readonly-fs.ts";
import * as P from "effect/Predicate";
import * as Arr from "effect/Array";
import { MutableMap } from "../../collection-boundary.ts";

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
  readPaywall(paywallId: string): Promise<PaywallVfsFiles | typeof Schema.Null.Type>;
}

const cleanedDocument = (root: SnapshotDocumentNode | typeof Schema.Null.Type): unknown => {
  if (root === null) {
    return null;
  }
  return serializeDocument([root]);
};

const componentFilesOf = (
  node: SnapshotDocumentNode,
): ReadonlyArray<{ readonly fileName: string; readonly source: string }> => {
  if (node.type !== "codeComponent") {
    return [];
  }
  const data = node.data ?? {};
  if (!P.isString(data.path) || !P.isString(data.source)) {
    return [];
  }
  return [{ fileName: fileNameFromDocRelative(data.path), source: data.source }];
};

/**
 * Shape a decoded document root into its VFS files: pretty-printed cleaned
 * document JSON plus the local `codeComponent` sources (walked from the
 * singleton `library` node) named by their `<name>.tsx` file basename.
 */
export const paywallVfsFiles = (
  root: SnapshotDocumentNode | typeof Schema.Null.Type,
): PaywallVfsFiles => {
  const cleaned = cleanedDocument(root);
  const library = (root?.children ?? []).find((child) => child.type === "library");
  const components = (library?.children ?? []).flatMap(componentFilesOf);
  return { documentJson: `${Formatter.formatJson(cleaned, { space: 2 })}\n`, components };
};

const COMPONENTS_DIR = "components";
const DOCUMENT_FILE = "document.json";

/** The stat shape {@link ReadOnlyDirProvider} answers with. */
type ReadOnlyStat = { kind: "file" | "dir"; size?: number };

const pathSegments = (relPath: string): ReadonlyArray<string> => {
  if (relPath === "") {
    return [];
  }
  return relPath.split("/");
};

// The provider contract is promise-typed (just-bash calls it directly), and
// `Promise.resolve` is not available under the Effect lint preset — an already
// completed Effect gives the same synchronously-settled promise.
const resolved = <A>(value: A): Promise<A> => runPromise(Effect.succeed(value));

/**
 * `/paywalls` provider: one directory per paywall id. The listing and each
 * paywall's files are memoized per instance (= per bash invocation), so a
 * `grep -r /paywalls` reads every document exactly once. Ids not present in
 * the project listing resolve to ENOENT without touching `readPaywall` — the
 * listing is the project-scope gate.
 */
export class PaywallsProvider implements ReadOnlyDirProvider {
  private listing: Promise<ReadonlyArray<WorkspaceVfsPaywall>> | typeof Schema.Undefined.Type;
  private readonly files = new MutableMap<
    string,
    Promise<PaywallVfsFiles | typeof Schema.Null.Type>
  >();
  private readonly sources: WorkspaceVfsSources;

  constructor(sources: WorkspaceVfsSources) {
    this.sources = sources;
  }

  private list(): Promise<ReadonlyArray<WorkspaceVfsPaywall>> {
    this.listing ??= this.sources.listPaywalls();
    return this.listing;
  }

  private filesOf(paywallId: string): Promise<PaywallVfsFiles | typeof Schema.Null.Type> {
    return this.list().then(
      (paywalls): Promise<PaywallVfsFiles | typeof Schema.Null.Type> | typeof Schema.Null.Type => {
        if (!paywalls.some((paywall) => paywall.paywallId === paywallId)) {
          return null;
        }
        const cached = this.files.get(paywallId);
        if (cached !== undefined) {
          return cached;
        }
        const files = this.sources.readPaywall(paywallId);
        this.files.set(paywallId, files);
        return files;
      },
    );
  }

  readdir(relPath: string): Promise<ReadonlyArray<ReadOnlyDirEntry> | typeof Schema.Null.Type> {
    const segments = pathSegments(relPath);
    if (Arr.isReadonlyArrayEmpty(segments)) {
      return this.list().then(
        (paywalls): ReadonlyArray<ReadOnlyDirEntry> =>
          paywalls.map((paywall) => ({ name: paywall.paywallId, kind: "dir" })),
      );
    }
    if (segments.length === 1) {
      return this.filesOf(unsafeDefined(segments[0])).then(
        (files): ReadonlyArray<ReadOnlyDirEntry> | typeof Schema.Null.Type => {
          if (files === null) {
            return null;
          }
          return [
            { name: DOCUMENT_FILE, kind: "file" },
            { name: COMPONENTS_DIR, kind: "dir" },
          ];
        },
      );
    }
    if (segments.length === 2 && segments[1] === COMPONENTS_DIR) {
      return this.filesOf(unsafeDefined(segments[0])).then(
        (files): ReadonlyArray<ReadOnlyDirEntry> | typeof Schema.Null.Type => {
          if (files === null) {
            return null;
          }
          return files.components.map((component) => ({ name: component.fileName, kind: "file" }));
        },
      );
    }
    return resolved(null);
  }

  stat(relPath: string): Promise<ReadOnlyStat | typeof Schema.Null.Type> {
    const segments = pathSegments(relPath);
    if (Arr.isReadonlyArrayEmpty(segments)) {
      return resolved<ReadOnlyStat>({ kind: "dir" });
    }
    if (segments.length === 1) {
      return this.filesOf(unsafeDefined(segments[0])).then(
        (files): ReadOnlyStat | typeof Schema.Null.Type => {
          if (files === null) {
            return null;
          }
          return { kind: "dir" };
        },
      );
    }
    if (segments.length === 2) {
      return this.filesOf(unsafeDefined(segments[0])).then(
        (files): ReadOnlyStat | typeof Schema.Null.Type => {
          if (files === null) {
            return null;
          }
          if (segments[1] === DOCUMENT_FILE) {
            return { kind: "file", size: new TextEncoder().encode(files.documentJson).length };
          }
          if (segments[1] === COMPONENTS_DIR) {
            return { kind: "dir" };
          }
          return null;
        },
      );
    }
    if (segments.length === 3 && segments[1] === COMPONENTS_DIR) {
      return this.componentSource(unsafeDefined(segments[0]), unsafeDefined(segments[2])).then(
        (source): ReadOnlyStat | typeof Schema.Null.Type => {
          if (source === null) {
            return null;
          }
          return { kind: "file", size: new TextEncoder().encode(source).length };
        },
      );
    }
    return resolved(null);
  }

  readFile(relPath: string): Promise<string | typeof Schema.Null.Type> {
    const segments = pathSegments(relPath);
    if (segments.length === 2 && segments[1] === DOCUMENT_FILE) {
      return this.filesOf(unsafeDefined(segments[0])).then(
        (files): string | typeof Schema.Null.Type => {
          if (files === null) {
            return null;
          }
          return files.documentJson;
        },
      );
    }
    if (segments.length === 3 && segments[1] === COMPONENTS_DIR) {
      return this.componentSource(unsafeDefined(segments[0]), unsafeDefined(segments[2]));
    }
    return resolved(null);
  }

  private componentSource(
    paywallId: string,
    fileName: string,
  ): Promise<string | typeof Schema.Null.Type> {
    return this.filesOf(paywallId).then((files): string | typeof Schema.Null.Type => {
      const component = files?.components.find((candidate) => candidate.fileName === fileName);
      return component?.source ?? null;
    });
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
export const makeWorkspaceVfs = (sources: WorkspaceVfsSources): Promise<IFileSystem> => {
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
  return fs
    .mkdir("/tmp")
    .then(() => fs.mkdir("/home/user", { recursive: true }))
    .then(() => fs);
};
