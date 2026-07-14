import {
  designerToolDescriptions,
  designerToolOutputSchemas,
  designerToolSchemas,
  modelForTurn,
  previewScreenshotToolResultSchema,
  type Surface,
} from "@voidhash/ai-shared";
import { AiChatService, PaywallService, PaywallWorkspaceService } from "@voidhash/core/services";
import { AuthSession } from "@voidhash/core/domain/auth/Auth";
import { fileNameFromDocRelative, readComponentDefinitions } from "@voidhash/paywall-workspace";
import { Context, Effect, Layer, Schema } from "effect";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
  type InferUITools,
  type ToolSet,
  type UIDataTypes,
  type UIMessage,
  validateUIMessages,
} from "ai";
import { createWorkersAI, type WorkersAISettings } from "workers-ai-provider";

import { type DesignerContext, designerSystemPrompt } from "./surfaces.ts";

/** Runtime handle consumed by the Cloudflare Workers AI implementation. */
export interface AiGatewayHandle {
  readonly binding: Extract<WorkersAISettings, { binding: unknown }>["binding"];
  readonly gatewayId: string;
}

/**
 * Server-side backstop on tool steps within ONE request — NOT a task budget.
 * With client-executed tools each request ends when the model calls tools
 * (finishReason `"tool-calls"`), the browser runs them, and the chat
 * auto-continues; this only bounds a within-request loop where the model calls
 * tools and immediately calls more without pause. Set generously so real
 * multi-step design work never hits it; a genuine runaway trips it. The
 * per-request cap is the SERVER's safety net; the browser also caps
 * auto-continuations.
 */
const MAX_TOOL_STEPS = 128;

/**
 * The provider truncated the model's output mid-message (`length`). Distinct
 * from `"tool-calls"`, which is the NORMAL end-of-request handoff to the browser
 * (the model asked to run client tools) — that is not truncation and gets no
 * notice. Only a genuine cut-off gets one.
 */
const truncationNotice = (): string =>
  "\n\n_I was cut off before finishing (the response hit the model's output limit). Ask me to continue and I can pick up where I left off._";

/** Tagged error raised by {@link VoidhashAiService} public methods. */
export class VoidhashAiError extends Schema.TaggedErrorClass<VoidhashAiError>("VoidhashAiError")(
  "VoidhashAiError",
  { message: Schema.String },
) {}

/** Everything the chat endpoint accepts. `messages` are UI messages from the AI SDK client. */
export interface VoidhashAiChatInput {
  readonly messages: ReadonlyArray<unknown>;
  readonly surface: Surface;
  /** Project the workspace tools operate over (anti-spoof-checked by the route). */
  readonly projectId: string;
  readonly organizationId: string;
  /** The open paywall id — chat persistence scope only (tools reach any paywall). */
  readonly paywallId: string;
  /** Client-minted chat id — the key server-authoritative persistence upserts by. */
  readonly chatId: string;
  /**
   * Mimic document node ids the user currently has selected in the open designer,
   * sent fresh per turn (older clients / other surfaces omit it). Surfaced to the
   * model in the designer context block — they are document node ids the model can
   * address directly in `edit_document` ops (from `get_document` / the selection).
   */
  readonly selectedNodeIds?: ReadonlyArray<string>;
}

/**
 * Services `chat` closes over: the designer-context builder's workspace/paywall
 * services plus `AiChatService` for transcript persistence. Captured once in
 * {@link VoidhashAiServiceShape.chat} (where the request's `AuthSession` is in
 * context) so the best-effort context builder + the finish-persist can run the
 * `AuthSession`-bound effects (streamText is not Effect-aware).
 */
type ChatContext = Context.Context<
  PaywallWorkspaceService | PaywallService | AiChatService | AuthSession
>;

/** Public {@link VoidhashAiService} surface. */
export interface VoidhashAiServiceShape {
  /**
   * Runs one streaming chat turn for the given studio surface. The declared
   * designer tools are SCHEMA-ONLY (no `execute`): the AI SDK ends the request
   * when the model calls a tool (finishReason `"tool-calls"`), the BROWSER
   * executes it against the local fork, and the chat auto-continues (AI SDK v5
   * client-tool round-trip). On finish, the message list so far is persisted
   * server-authoritatively via {@link AiChatService} (each continuation request
   * re-persists the full transcript).
   *
   * Requires the request's per-request services in context (the route resolves
   * the session and provides `AuthSession` + the workspace/chat services).
   */
  readonly chat: (
    input: VoidhashAiChatInput,
  ) => Effect.Effect<
    Response,
    VoidhashAiError,
    PaywallWorkspaceService | PaywallService | AiChatService | AuthSession
  >;
}

/** Service tag — the live layer is built by {@link VoidhashAiService.layer}. */
export class VoidhashAiService extends Context.Service<VoidhashAiService, VoidhashAiServiceShape>()(
  "VoidhashAiService",
) {
  /** Builds the live service around a runtime {@link AiGatewayHandle}. */
  static readonly layer = (handle: AiGatewayHandle): Layer.Layer<VoidhashAiService> =>
    Layer.succeed(VoidhashAiService, make(handle));
}

/**
 * The id of the last user message — the checkpoint turn identifier. Falls back
 * to a synthesized id when the messages carry none (defensive; UI messages
 * always have ids in practice).
 */
const turnIdFromMessages = (messages: ReadonlyArray<UIMessage>): string => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role === "user" && typeof message.id === "string" && message.id.length > 0) {
      return message.id;
    }
  }
  return `turn_${Date.now()}`;
};

/** First non-empty user text, trimmed to a short title; falls back to "New chat". */
const deriveTitle = (messages: ReadonlyArray<UIMessage>): string => {
  for (const message of messages) {
    if (message.role !== "user") {
      continue;
    }
    const text = message.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("")
      .trim();
    if (text.length > 0) {
      return text.length > 80 ? `${text.slice(0, 79)}…` : text;
    }
  }
  return "New chat";
};

/**
 * Build the designer tool set as SCHEMA-ONLY declarations (no `execute`). With no
 * `execute`, the AI SDK ends the request when the model calls a tool
 * (finishReason `"tool-calls"`); the BROWSER runs the tool against the currently
 * open paywall document and the chat auto-continues (AI SDK v5 client-tool
 * round-trip). Each tool's `description` + `inputSchema` come from the shared
 * `ai-shared` definitions the browser executor imports, so declaration and
 * execution stay in lockstep.
 *
 * The declaration list is exactly the shared vocabulary, including rendered
 * inspection/screenshot review, document/component writes, subtree duplication,
 * and the final design gate. Each entry keys straight off
 * `designerToolSchemas`/`designerToolDescriptions`, so a rename in the shared
 * package fails this file at compile time rather than drifting. (Built per-tool
 * rather than mapped so the AI SDK infers each concrete input/output schema.)
 */
export const designerTools = () =>
  ({
    get_document: tool({
      description: designerToolDescriptions.get_document,
      inputSchema: designerToolSchemas.get_document,
      outputSchema: designerToolOutputSchemas.get_document,
    }),
    get_rendered_layout: tool({
      description: designerToolDescriptions.get_rendered_layout,
      inputSchema: designerToolSchemas.get_rendered_layout,
      outputSchema: designerToolOutputSchemas.get_rendered_layout,
    }),
  get_preview_screenshot: tool({
    description: designerToolDescriptions.get_preview_screenshot,
    inputSchema: designerToolSchemas.get_preview_screenshot,
    outputSchema: previewScreenshotToolResultSchema,
    toModelOutput: ({ output }) =>
      typeof output === "string"
        ? { type: "text", value: output }
        : {
            type: "content",
            value: [
              {
                type: "text",
                text: `${output.message}\nDocument signature: ${output.documentSignature}\nRendered at ${output.width}×${output.height}px (${output.scale}x).`,
              },
              {
                type: "file",
                data: { type: "data", data: output.dataBase64 },
                filename: "paywall-preview.png",
                mediaType: output.mediaType,
              },
            ],
          },
    }),
    get_components: tool({
      description: designerToolDescriptions.get_components,
      inputSchema: designerToolSchemas.get_components,
      outputSchema: designerToolOutputSchemas.get_components,
    }),
    read_component: tool({
      description: designerToolDescriptions.read_component,
      inputSchema: designerToolSchemas.read_component,
      outputSchema: designerToolOutputSchemas.read_component,
    }),
    read_paywall: tool({
      description: designerToolDescriptions.read_paywall,
      inputSchema: designerToolSchemas.read_paywall,
      outputSchema: designerToolOutputSchemas.read_paywall,
    }),
    edit_document: tool({
      description: designerToolDescriptions.edit_document,
      inputSchema: designerToolSchemas.edit_document,
      outputSchema: designerToolOutputSchemas.edit_document,
    }),
    duplicate_subtree: tool({
      description: designerToolDescriptions.duplicate_subtree,
      inputSchema: designerToolSchemas.duplicate_subtree,
      outputSchema: designerToolOutputSchemas.duplicate_subtree,
    }),
    write_component: tool({
      description: designerToolDescriptions.write_component,
      inputSchema: designerToolSchemas.write_component,
      outputSchema: designerToolOutputSchemas.write_component,
    }),
    rename_component: tool({
      description: designerToolDescriptions.rename_component,
      inputSchema: designerToolSchemas.rename_component,
      outputSchema: designerToolOutputSchemas.rename_component,
    }),
    delete_component: tool({
      description: designerToolDescriptions.delete_component,
      inputSchema: designerToolSchemas.delete_component,
      outputSchema: designerToolOutputSchemas.delete_component,
    }),
    finish_design: tool({
      description: designerToolDescriptions.finish_design,
      inputSchema: designerToolSchemas.finish_design,
      outputSchema: designerToolOutputSchemas.finish_design,
    }),
  }) satisfies ToolSet;

type DesignerUIMessage = UIMessage<
  unknown,
  UIDataTypes,
  InferUITools<ReturnType<typeof designerTools>>
>;

/**
 * Component file names (`<basename>.tsx`) of a paywall document, read from its
 * `codeComponent` definition nodes — a component's identity is its canonical
 * document-relative `path` (`components/<basename>.tsx`), which reduces to the
 * file name for display.
 */
const componentFileNamesFromDocument = (root: unknown): ReadonlyArray<string> => {
  // The decoded renderer root is the single `SnapshotNode` the pure reader walks;
  // narrow the mimic-host `unknown` structurally (the renderer type package is not
  // a backend dependency) via the reader's own parameter type.
  const snapshot = (root != null ? [root] : []) as unknown as Parameters<
    typeof readComponentDefinitions
  >[0];
  return readComponentDefinitions(snapshot).map((definition) =>
    fileNameFromDocRelative(definition.path),
  );
};

/**
 * Build the dynamic {@link DesignerContext} for the request — the project's
 * paywall listing (slug + display name + component file names), which paywall is
 * open (resolved from `input.paywallId`), and the current selection. Best-effort:
 * it reads each paywall's live document (no projection) and NEVER fails the chat —
 * any failure resolving the whole block, or an individual paywall's document,
 * degrades to omitting that part (`undefined` whole block, or an empty component
 * list for the paywall that failed).
 */
const buildDesignerContext = (
  context: ChatContext,
  input: VoidhashAiChatInput,
): Promise<DesignerContext | undefined> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const paywallService = yield* PaywallService;
      const workspace = yield* PaywallWorkspaceService;
      const rows = yield* paywallService.getPaywalls(input.projectId);

      const paywalls = yield* Effect.forEach(
        rows,
        (row) =>
          workspace.readDocument(input.projectId, row.slug).pipe(
            Effect.map((resolved) => ({
              slug: row.slug,
              name: row.name,
              componentFileNames: componentFileNamesFromDocument(resolved.root),
            })),
            // One unreadable/corrupt paywall must not sink the whole block — list
            // it with no components rather than dropping the context entirely.
            Effect.catch(() =>
              Effect.succeed({ slug: row.slug, name: row.name, componentFileNames: [] }),
            ),
          ),
        { concurrency: 8 },
      );

      const openRow = rows.find((row) => row.id === input.paywallId);
      return {
        paywalls,
        openPaywall: openRow ? { slug: openRow.slug, name: openRow.name } : undefined,
        selectedNodeIds: input.selectedNodeIds ?? [],
      } satisfies DesignerContext;
    }).pipe(
      Effect.provide(context),
      Effect.catch(() => Effect.succeed(undefined)),
    ) as Effect.Effect<DesignerContext | undefined, never>,
  );

const make = (handle: AiGatewayHandle): VoidhashAiServiceShape => {
  const workersai = createWorkersAI({
    binding: handle.binding,
    gateway: { id: handle.gatewayId },
  });

  const chat: VoidhashAiServiceShape["chat"] = (input) =>
    Effect.gen(function* () {
      // Capture the request context (AuthSession + workspace/paywall/chat
      // services) so the best-effort designer-context builder and the
      // finish-persist can run the AuthSession-bound effects (streamText is not
      // Effect-aware). The designer tools are schema-only — the browser executes
      // them — so no tool `execute` runs against this context.
      const context = yield* Effect.context<
        PaywallWorkspaceService | PaywallService | AiChatService | AuthSession
      >();

      return yield* Effect.tryPromise({
        catch: (cause) =>
          new VoidhashAiError({
            message: cause instanceof Error ? cause.message : String(cause),
          }),
        try: async (): Promise<Response> => {
          const tools = designerTools();
          const uiMessages = await validateUIMessages<DesignerUIMessage>({
            messages: input.messages,
            tools,
          });
          const modelMessages = await convertToModelMessages(uiMessages, { tools });
          const turnId = turnIdFromMessages(uiMessages);
          const designerContext = await buildDesignerContext(context, input);

          const result = streamText({
            model: workersai(modelForTurn(input.surface, input.messages)),
            system: designerSystemPrompt(designerContext),
            messages: modelMessages,
            tools,
            stopWhen: stepCountIs(MAX_TOOL_STEPS),
          });

          // Merge the model's UI stream into our own stream so we can append a
          // truncation notice ONLY when the provider truncated the output
          // (`length`). finishReason `"tool-calls"` is the NORMAL handoff to the
          // browser (client tools) — not truncation — so it gets no notice; the
          // client runs the tools and auto-continues. `sendFinish: false` holds
          // the finish event until after any notice is written.
          const stream = createUIMessageStream<UIMessage>({
            originalMessages: uiMessages,
            execute: async ({ writer }) => {
              writer.merge(result.toUIMessageStream({ sendFinish: false }));
              const finishReason = await result.finishReason;
              if (finishReason === "length") {
                const id = `notice_${turnId}`;
                writer.write({ type: "text-start", id });
                writer.write({ type: "text-delta", id, delta: truncationNotice() });
                writer.write({ type: "text-end", id });
              }
            },
            // Server-authoritative persistence: `messages` is the fully assembled
            // UI-message list (original + this turn's assistant + server-executed
            // tool parts the client never re-sends, plus any truncation notice),
            // upserted under the client-minted chat id. Skipped on an aborted stream.
            onFinish: ({ messages, isAborted }) => {
              if (!isAborted) {
                void persistOnFinish(context, input, messages);
              }
            },
          });
          return createUIMessageStreamResponse({ stream });
        },
      });
    });

  return { chat };
};

/**
 * Persist the completed chat server-authoritatively. Best-effort: a persistence
 * failure must not fail an already-streamed turn, so failures are swallowed
 * (the client refetches the history list on stream finish regardless). The
 * response body carries the assistant + tool parts; we persist the input UI
 * messages plus rely on the client refetch for the freshest full transcript.
 */
const persistOnFinish = async (
  context: ChatContext,
  input: VoidhashAiChatInput,
  messages: ReadonlyArray<UIMessage>,
): Promise<void> => {
  await Effect.runPromiseExit(
    Effect.gen(function* () {
      const chats = yield* AiChatService;
      yield* chats.save({
        id: input.chatId,
        organizationId: input.organizationId,
        projectId: input.projectId,
        surface: input.surface,
        chatType: "persistent",
        paywallId: input.paywallId,
        title: deriveTitle(messages),
        messages: JSON.stringify(messages),
      });
    }).pipe(
      Effect.provide(context),
      Effect.catch(() => Effect.void),
    ) as Effect.Effect<void, never>,
  );
};
