import * as Cloudflare from "alchemy/Cloudflare";
export { MimicDocumentIdleMessage, type MimicDocumentIdleMessageType } from "../ws/idle-notify.ts";

/**
 * Queue that the mimic-db document Durable Objects publish to when a
 * collaborative editing session goes idle (the last authenticated socket
 * disconnected after the document was edited). The backend worker consumes
 * these messages and re-renders the paywall thumbnail; mimic-db stays a generic
 * document store and publishes for every collection, so the backend consumer is
 * responsible for filtering to paywall collections.
 *
 * The producer is the mimic-db worker; alchemy's `QueueBindingPolicyLive` binds
 * the queue on the Worker env under this resource's LogicalId
 * (`MimicDocumentIdleQueue`), which is the env key the producer looks up. No
 * dead-letter queue: a failed publish simply leaves `notifiedSeq` unpersisted, so
 * the next disconnect re-triggers.
 */
export const MimicDocumentIdleQueue = Cloudflare.Queues.Queue("MimicDocumentIdleQueue");
