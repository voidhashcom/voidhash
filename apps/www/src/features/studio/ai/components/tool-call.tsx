import type { DynamicToolUIPart, ToolUIPart } from "ai";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  cn,
  Spinner,
} from "@voidhash/ui";
import { AlertCircle, ChevronRight, CheckCircle2, Wrench } from "lucide-react";

/** Any tool invocation part — statically-typed or the dynamic (server-declared) shape. */
type AnyToolPart = ToolUIPart | DynamicToolUIPart;

/** Human-facing tool name for both dynamic and static tool parts. */
function toolNameOf(part: AnyToolPart): string {
  return part.type === "dynamic-tool" ? part.toolName : part.type.slice("tool-".length);
}

/** Stringify tool input/output for display; strings pass through, objects pretty-print. */
function formatValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Status icon for the tool's current lifecycle state. */
function StatusIcon({ state }: { state: AnyToolPart["state"] }) {
  if (state === "output-error") {
    return <AlertCircle className="size-3.5 text-destructive" />;
  }
  if (state === "output-available") {
    return <CheckCircle2 className="size-3.5 text-muted-foreground" />;
  }
  // input-streaming | input-available (and any approval states): still working.
  return <Spinner className="size-3.5" />;
}

/**
 * Renders a single tool invocation as a collapsed, subtle row: header shows the
 * tool name and a status icon; expanding reveals the pretty-printed input and,
 * when available, the tool output (or the error text). Closed by default.
 */
export function ToolCallView({ part }: { part: AnyToolPart }) {
  const name = toolNameOf(part);
  const input = formatValue(part.input);
  const output =
    part.state === "output-error"
      ? part.errorText
      : part.state === "output-available"
        ? formatValue(part.output)
        : "";

  return (
    <Collapsible className="w-fit max-w-full min-w-0">
      <CollapsibleTrigger
        className={cn(
          "group/tool flex items-center gap-1.5 rounded-md border border-border bg-sidebar px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground",
        )}
      >
        <ChevronRight className="size-3.5 transition-transform group-data-[state=open]/tool:rotate-90" />
        <Wrench className="size-3.5" />
        <span className="font-medium">{name}</span>
        <StatusIcon state={part.state} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 min-w-0">
        <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-2 text-xs">
          {input && (
            <div className="min-w-0">
              <div className="mb-1 font-medium text-muted-foreground">Input</div>
              <pre className="max-h-48 overflow-auto rounded bg-background p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap wrap-break-word">
                {input}
              </pre>
            </div>
          )}
          {output && (
            <div className="min-w-0">
              <div className="mb-1 font-medium text-muted-foreground">
                {part.state === "output-error" ? "Error" : "Output"}
              </div>
              <pre
                className={cn(
                  "max-h-48 overflow-auto rounded bg-background p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap wrap-break-word",
                  part.state === "output-error" && "text-destructive",
                )}
              >
                {output}
              </pre>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
