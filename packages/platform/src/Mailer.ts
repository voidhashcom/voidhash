import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { PlatformRuntime } from "./PlatformRuntime.ts";

/** Stable failure raised by a mail-delivery adapter. */
export class MailerError extends Schema.TaggedErrorClass<MailerError>("MailerError")(
  "MailerError",
  {
    cause: Schema.String,
    operation: Schema.String,
  },
) {}

/** Structured email mailbox. */
export interface MailAddress {
  readonly address: string;
  readonly name?: string;
}

/** Provider-neutral email message input. */
export interface MailMessage {
  readonly from?: MailAddress;
  readonly to: ReadonlyArray<MailAddress>;
  readonly cc?: ReadonlyArray<MailAddress>;
  readonly bcc?: ReadonlyArray<MailAddress>;
  readonly replyTo?: MailAddress;
  readonly subject: string;
  readonly text?: string;
  readonly html?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

/** Delivery acknowledgement returned by the SMTP server. */
export interface MailDeliveryResult {
  readonly messageId: string;
  readonly accepted: ReadonlyArray<string>;
  readonly rejected: ReadonlyArray<string>;
}

/** Provider-neutral mail-delivery capabilities. */
export interface MailerShape {
  readonly send: (
    message: MailMessage,
  ) => Effect.Effect<MailDeliveryResult, MailerError, PlatformRuntime>;
}

/** Provider-neutral transactional email delivery service. */
export class Mailer extends Context.Service<Mailer, MailerShape>()("@voidhash/platform/Mailer") {}
