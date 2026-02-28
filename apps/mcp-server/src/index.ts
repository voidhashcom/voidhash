#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v4";

import { ApiService } from "./api";
import {
  addNode,
  moveNode,
  removeNode,
  setNodeStyle,
  setTextContent,
  toSnapshotMetadata,
  updateNode,
} from "./designer-ops";
import { DesignerSessionManager } from "./designer-session-manager";
import { loadConfig } from "./config";
import { AppError, normalizeUnknownError, toAppError } from "./errors";

const toToolSuccess = (payload: unknown) => ({
  content: [
    {
      text: JSON.stringify(payload, null, 2),
      type: "text" as const,
    },
  ],
});

const toToolFailure = (error: unknown) => {
  const appError = toAppError(error, "VALIDATION_ERROR", "Tool execution failed");

  return {
    content: [
      {
        text: JSON.stringify(
          {
            error: {
              code: appError.code,
              details: appError.details,
              message: appError.message,
            },
          },
          null,
          2,
        ),
        type: "text" as const,
      },
    ],
    isError: true,
  };
};

const withToolHandler = <T,>(handler: () => Promise<T>) =>
  handler().then(toToolSuccess).catch(toToolFailure);

const toDateTimestamp = (value: unknown): number | null => {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  return null;
};

const sortByCreatedAtThenName = <T extends { createdAt?: unknown; name: string }>(
  items: readonly T[],
): T[] =>
  [...items].sort((left, right) => {
    const leftCreatedAt = toDateTimestamp(left.createdAt);
    const rightCreatedAt = toDateTimestamp(right.createdAt);

    if (leftCreatedAt !== null && rightCreatedAt !== null && leftCreatedAt !== rightCreatedAt) {
      return leftCreatedAt - rightCreatedAt;
    }

    if (leftCreatedAt !== null && rightCreatedAt === null) {
      return -1;
    }

    if (leftCreatedAt === null && rightCreatedAt !== null) {
      return 1;
    }

    return left.name.localeCompare(right.name);
  });

const buildServer = async () => {
  const config = await loadConfig();
  const apiService = new ApiService(config);
  const sessionManager = new DesignerSessionManager(apiService, config.wsBaseUrl);

  const server = new McpServer({
    name: "voidhash-mcp-server",
    version: "0.0.1-alpha.1",
  });

  server.registerTool(
    "paywall_create",
    {
      description: "Create a paywall in a Voidhash project",
      inputSchema: z.object({
        name: z.string().min(1),
        projectId: z.string().min(1),
        slug: z.string().min(1),
      }),
    },
    ({ name, projectId, slug }) =>
      withToolHandler(async () => {
        const created = await apiService.createPaywall({ name, projectId, slug });
        return {
          ...created,
          name,
          projectId,
          slug,
        };
      }),
  );

  server.registerTool(
    "paywall_list",
    {
      description: "List paywalls for a Voidhash project",
      inputSchema: z.object({
        projectId: z.string().min(1),
      }),
    },
    ({ projectId }) =>
      withToolHandler(async () => {
        const paywalls = await apiService.listPaywalls(projectId);
        return {
          paywalls: sortByCreatedAtThenName(paywalls),
          projectId,
        };
      }),
  );

  server.registerTool(
    "paywall_designer_connect",
    {
      description:
        "Connect to one active paywall designer websocket session. Existing active session is replaced.",
      inputSchema: z.object({
        paywallId: z.string().min(1),
      }),
    },
    ({ paywallId }) =>
      withToolHandler(async () => {
        const session = await sessionManager.connect(paywallId);
        return {
          session,
        };
      }),
  );

  server.registerTool(
    "paywall_designer_disconnect",
    {
      description: "Disconnect the active paywall designer session",
      inputSchema: z.object({}),
    },
    () =>
      withToolHandler(async () => {
        const previousSession = await sessionManager.disconnect();
        return {
          disconnected: true,
          previousSession,
        };
      }),
  );

  server.registerTool(
    "paywall_designer_snapshot",
    {
      description: "Read the full current snapshot from the active designer session",
      inputSchema: z.object({}),
    },
    () =>
      withToolHandler(async () => {
        const document = sessionManager.getActiveDocument();
        const snapshot = document.root.toSnapshot();
        return {
          metadata: toSnapshotMetadata(snapshot, null),
          snapshot,
        };
      }),
  );

  server.registerTool(
    "paywall_designer_add_node",
    {
      description: "Add a node to the active designer document",
      inputSchema: z.object({
        afterSiblingId: z.string().optional(),
        beforeSiblingId: z.string().optional(),
        initialValues: z.record(z.string(), z.unknown()).optional(),
        nodeType: z.enum(["screen", "flex", "text", "shape", "path"]),
        parentId: z.string().nullable(),
      }),
    },
    (input) =>
      withToolHandler(async () => {
        const document = sessionManager.getActiveDocument();
        const nodeId = addNode(document, input);
        const snapshot = document.root.toSnapshot();

        return {
          metadata: toSnapshotMetadata(snapshot, nodeId),
          nodeId,
          snapshot,
        };
      }),
  );

  server.registerTool(
    "paywall_designer_update_node",
    {
      description: "Apply a partial node update in the active designer document",
      inputSchema: z.object({
        nodeId: z.string().min(1),
        updates: z.record(z.string(), z.unknown()),
      }),
    },
    ({ nodeId, updates }) =>
      withToolHandler(async () => {
        const document = sessionManager.getActiveDocument();
        updateNode(document, nodeId, updates);
        const snapshot = document.root.toSnapshot();

        return {
          metadata: toSnapshotMetadata(snapshot, nodeId),
          nodeId,
          snapshot,
        };
      }),
  );

  server.registerTool(
    "paywall_designer_remove_node",
    {
      description: "Remove a node from the active designer document",
      inputSchema: z.object({
        nodeId: z.string().min(1),
      }),
    },
    ({ nodeId }) =>
      withToolHandler(async () => {
        const document = sessionManager.getActiveDocument();
        removeNode(document, nodeId);
        const snapshot = document.root.toSnapshot();

        return {
          metadata: toSnapshotMetadata(snapshot, nodeId),
          removedNodeId: nodeId,
          snapshot,
        };
      }),
  );

  server.registerTool(
    "paywall_designer_move_node",
    {
      description: "Move a node in the active designer document",
      inputSchema: z.object({
        afterSiblingId: z.string().optional(),
        beforeSiblingId: z.string().optional(),
        newParentId: z.string().nullable().optional(),
        nodeId: z.string().min(1),
        toIndex: z.number().int().nonnegative().optional(),
      }),
    },
    (input) =>
      withToolHandler(async () => {
        const document = sessionManager.getActiveDocument();
        moveNode(document, input);
        const snapshot = document.root.toSnapshot();

        return {
          metadata: toSnapshotMetadata(snapshot, input.nodeId),
          movedNodeId: input.nodeId,
          snapshot,
        };
      }),
  );

  server.registerTool(
    "paywall_designer_set_style",
    {
      description: "Set style fields on a node in the active designer document",
      inputSchema: z.object({
        nodeId: z.string().min(1),
        style: z.record(z.string(), z.unknown()),
      }),
    },
    ({ nodeId, style }) =>
      withToolHandler(async () => {
        const document = sessionManager.getActiveDocument();
        setNodeStyle(document, nodeId, style);
        const snapshot = document.root.toSnapshot();

        return {
          metadata: toSnapshotMetadata(snapshot, nodeId),
          nodeId,
          snapshot,
        };
      }),
  );

  server.registerTool(
    "paywall_designer_set_text",
    {
      description: "Set text value for a text node in the active designer document",
      inputSchema: z.object({
        nodeId: z.string().min(1),
        text: z.string(),
      }),
    },
    ({ nodeId, text }) =>
      withToolHandler(async () => {
        const document = sessionManager.getActiveDocument();
        setTextContent(document, nodeId, text);
        const snapshot = document.root.toSnapshot();

        return {
          metadata: toSnapshotMetadata(snapshot, nodeId),
          nodeId,
          snapshot,
        };
      }),
  );

  server.registerTool(
    "paywall_location_list",
    {
      description: "List paywall locations (read-only)",
      inputSchema: z.object({}),
    },
    () =>
      withToolHandler(async () => {
        const locations = await apiService.listPaywallLocations();
        return {
          locations: sortByCreatedAtThenName(locations),
        };
      }),
  );

  return server;
};

const start = async () => {
  let server: McpServer | null = null;
  try {
    server = await buildServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    const startupError =
      error instanceof AppError
        ? error
        : new AppError("CONFIG_ERROR", "Failed to start voidhash-mcp-server", {
            cause: normalizeUnknownError(error),
          });

    process.stderr.write(
      `${JSON.stringify(
        {
          error: {
            code: startupError.code,
            details: startupError.details,
            message: startupError.message,
          },
        },
        null,
        2,
      )}\n`,
    );

    process.exitCode = 1;
    if (server) {
      await server.close();
    }
  }
};

void start();
