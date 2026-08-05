/** Resource kinds understood by platform runtimes and deployment adapters. */
export type PrimitiveKind = "cron" | "durable-entity" | "queue" | "queue-consumer" | "workflow";

/** Provider-neutral identity shared by every platform primitive definition. */
export interface PrimitiveDefinition<
  Kind extends PrimitiveKind = PrimitiveKind,
  Name extends string = string,
> {
  readonly kind: Kind;
  readonly name: Name;
}
