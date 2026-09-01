import { PaywallService, PaywallWorkspaceService } from "@voidhash/core/services";
import { AuthSession } from "@voidhash/core/domain/auth/Auth";
import { fileNameFromDocRelative, readComponentDefinitions } from "@voidhash/paywall-workspace";
import { pick } from "@voidhash/lib/lang";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as Arr from "effect/Array";
import * as Schema from "effect/Schema";
import { recoverCause } from "../runtime-boundary.ts";

type DocumentSnapshotNode = Parameters<typeof readComponentDefinitions>[0][number];

const isSnapshotNode = (value: unknown): value is DocumentSnapshotNode =>
  P.isObject(value) && value !== null;

/** Server-resolved facts about the user's current designer workspace. */
export interface DesignerContext {
  readonly paywalls: ReadonlyArray<{
    readonly paywallId: string;
    readonly slug: string;
    readonly name: string;
    readonly componentFileNames: ReadonlyArray<string>;
  }>;
  readonly openPaywall?: {
    readonly paywallId: string;
    readonly slug: string;
    readonly name: string;
  };
  readonly selectedNodeIds: ReadonlyArray<string>;
}

/** Identifiers used to resolve a fresh designer context before each model turn. */
export interface DesignerContextInput {
  readonly projectId: string;
  readonly paywallId?: string;
  readonly selectedNodeIds: ReadonlyArray<string>;
}

const componentFileNamesFromDocument = (root: unknown): ReadonlyArray<string> => {
  if (!isSnapshotNode(root)) return [];
  return readComponentDefinitions([root]).map((definition) =>
    fileNameFromDocRelative(definition.path),
  );
};

/**
 * Resolves the live project/paywall/selection context. Resolution is
 * best-effort so an unreadable sibling document never prevents an agent turn.
 */
export const buildDesignerContext = (
  input: DesignerContextInput,
): Effect.Effect<
  DesignerContext | typeof Schema.Undefined.Type,
  never,
  PaywallService | PaywallWorkspaceService | AuthSession
> =>
  Effect.gen(function* () {
    const paywallService = yield* PaywallService;
    const workspace = yield* PaywallWorkspaceService;
    const rows = yield* paywallService.getPaywalls(input.projectId);
    const paywalls = yield* Effect.forEach(
      rows,
      (row) =>
        workspace.readDocument(input.projectId, row.slug).pipe(
          Effect.map((resolved) => ({
            paywallId: row.id,
            slug: row.slug,
            name: row.name,
            componentFileNames: componentFileNamesFromDocument(resolved.root),
          })),
          recoverCause(() => ({
              paywallId: row.id,
              slug: row.slug,
              name: row.name,
              componentFileNames: [],
            })),
        ),
      { concurrency: 8 },
    );
    const openRow = rows.find((row) => row.id === input.paywallId);
    if (openRow === undefined) {
      return { paywalls, selectedNodeIds: input.selectedNodeIds };
    }
    return {
      paywalls,
      openPaywall: {
        paywallId: openRow.id,
        slug: openRow.slug,
        name: openRow.name,
      },
      selectedNodeIds: input.selectedNodeIds,
    };
  }).pipe(recoverCause(() => undefined));

const formatComponents = (componentFileNames: ReadonlyArray<string>): string => {
  if (Arr.isReadonlyArrayEmpty(componentFileNames)) return "no code components";
  return `components: ${componentFileNames.map((fileName) => `components/${fileName}`).join(", ")}`;
};

const formatPaywallEntry = (paywall: DesignerContext["paywalls"][number]): string => {
  const components = formatComponents(paywall.componentFileNames);
  return `- ${paywall.paywallId} ("${paywall.name}", slug "${paywall.slug}"): ${components}`;
};

/** Renders the dynamic designer facts appended to the agent system prompt. */
export const renderDesignerContext = (context: DesignerContext): string => {
  const sections: string[] = [];
  if (Arr.isReadonlyArrayNonEmpty(context.paywalls)) {
    sections.push(
      `Paywalls in this project (stable id, display name, slug, code components):\n${context.paywalls.map(formatPaywallEntry).join("\n")}`,
    );
  }
  if (context.openPaywall !== undefined) {
    const { paywallId, slug, name } = context.openPaywall;
    const lines = [
      `The user currently has the "${name}" paywall (id "${paywallId}", slug "${slug}") open in the designer. Unqualified references like "this paywall", "the current screen", or "here" mean this one — open it with \`begin_paywall_edit({ paywallId: "${paywallId}" })\`, then pass the returned \`editSessionId\` to every scoped tool.`,
    ];
    if (Arr.isReadonlyArrayNonEmpty(context.selectedNodeIds)) {
      const plural = pick(context.selectedNodeIds.length === 1, "node", "nodes");
      lines.push(
        `The user currently has ${plural} with id ${context.selectedNodeIds.join(", ")} selected in the open paywall — these are document node ids you can target directly in \`edit_paywall\` ops (no need to re-locate them).`,
      );
    }
    sections.push(lines.join("\n"));
  } else {
    sections.push(
      "The user does not have a specific paywall open in the designer right now, so treat requests as project-wide unless they name a paywall.",
    );
  }
  if (Arr.isReadonlyArrayEmpty(sections)) return "";
  return `\n\nCurrent context:\n${sections.join("\n\n")}`;
};
