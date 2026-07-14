"use client";

import { useParams } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

import type { SurfaceAgent } from "@/features/studio/ai";
import { useAuth } from "@/features/studio/components/auth-context";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

import { useCodeEditor } from "../code-mode/code-editor-context";
import { finishAiCanvasOperation, startAiCanvasOperation } from "../state/actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../state/designer-store";
import { selectedNodeIdsFromPresence } from "../state/utils/presence";
import { useDesignerToolExecutor } from "./tool-executor";

/**
 * Assembles the designer {@link SurfaceAgent} consumed by the AI panel: its
 * surface id, the request context (organization / project / paywall ids resolved
 * from the route + the authenticated user), the client tool executor, and the
 * per-send hooks.
 *
 * The agent's tools are CLIENT-EXECUTED (the backend declares them schema-only
 * and ends the stream at a tool call; the chat auto-continues after the browser
 * runs the tool). {@link useDesignerToolExecutor} runs each tool directly against
 * the open paywall's mimic document.
 *
 * `getDynamicContext` carries the current node selection with each send (read on
 * demand, not subscribed). `beforeSend` saves the open Monaco buffers to their
 * `codeComponent` nodes so the agent reads the user's latest committed code — a
 * purely local, synchronous operation. `onActivityChange` mirrors coarse model
 * activity into the same transient canvas overlay used by individual tools.
 */
export function useDesignerAgent(): SurfaceAgent {
  const { user } = useAuth();
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { handle } = useCodeEditor();
  const executeTool = useDesignerToolExecutor();
  const { organizationSlug, projectSlug, id: paywallId } = useParams({ strict: false });

  const getDynamicContext = useCallback(
    () => ({
      selectedNodeIds: selectedNodeIdsFromPresence(store.getState().mimic.presence?.self),
    }),
    [store],
  );

  // Save the open Monaco buffers to their `codeComponent` nodes before each send
  // so the client tool executor reads the user's latest committed code (a no-op
  // when code mode is not open / nothing is dirty). Purely local + synchronous.
  const beforeSend = useCallback(() => {
    handle?.saveAll();
  }, [handle]);

  const onActivityChange = useCallback<NonNullable<SurfaceAgent["onActivityChange"]>>(
    (activity) => {
      if (activity.kind === "thinking") {
        dispatch(startAiCanvasOperation)({
          id: "agent-thinking",
          label: activity.label,
          nodeIds: [],
          phase: "thinking",
          startedAt: Date.now(),
        });
        return;
      }
      dispatch(finishAiCanvasOperation)({ id: "agent-thinking" });
    },
    [dispatch],
  );

  const organization = useMemo(
    () =>
      organizationSlug
        ? user.organizations.find((candidate) => candidate.slug === organizationSlug)
        : undefined,
    [user, organizationSlug],
  );
  const project = useMemo(
    () =>
      organizationSlug && projectSlug
        ? CurrentUser.getProjectBySlugs(user, organizationSlug, projectSlug)
        : null,
    [user, organizationSlug, projectSlug],
  );

  const projectId = project?.id ?? "";

  return useMemo<SurfaceAgent>(
    () => ({
      surfaceId: "designer",
      context: {
        organizationId: organization?.id ?? "",
        projectId,
        paywallId,
      },
      getDynamicContext,
      beforeSend,
      executeTool,
      onActivityChange,
      // Designer chats are context-specific and resumable: scoped to the paywall
      // and listed in the panel's history dropdown.
      persistence: { chatType: "persistent" },
    }),
    [
      organization?.id,
      projectId,
      paywallId,
      getDynamicContext,
      beforeSend,
      executeTool,
      onActivityChange,
    ],
  );
}
