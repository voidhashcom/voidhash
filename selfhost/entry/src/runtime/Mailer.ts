import {
  type MailAddress,
  type MailDeliveryResult,
  Mailer,
  MailerError,
  type MailerShape,
  type MailMessage,
} from "@orbian/sdk/Mailer";
import { PlatformRuntime } from "@orbian/sdk/PlatformRuntime";
import { Effect, Layer, Redacted } from "effect";
import nodemailer, { type Transporter } from "nodemailer";

/** SMTP connection, authentication, and sender defaults. */
export interface SmtpMailerConfig {
  readonly host: string;
  readonly port: number;
  readonly secure?: boolean;
  readonly requireTls?: boolean;
  readonly username?: string;
  readonly password?: Redacted.Redacted<string>;
  readonly defaultFrom?: MailAddress;
  readonly connectionTimeoutMillis?: number;
  readonly greetingTimeoutMillis?: number;
  readonly tlsRejectUnauthorized?: boolean;
  readonly verifyOnStart?: boolean;
}

const mailerError = (operation: string, cause: unknown) =>
  new MailerError({ operation, cause: String(cause) });

const mailbox = ({ address, name }: MailAddress) => ({ address, name });

const resultAddress = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "address" in value) {
    const address = (value as { readonly address?: unknown }).address;
    if (typeof address === "string") return address;
  }
  return String(value);
};

const validateMessage = (
  config: SmtpMailerConfig,
  message: MailMessage,
): Effect.Effect<MailAddress, MailerError> => {
  const from = message.from ?? config.defaultFrom;
  if (!from) return Effect.fail(mailerError("validate", "sender is required"));
  if (message.to.length === 0) {
    return Effect.fail(mailerError("validate", "at least one recipient is required"));
  }
  if (message.text === undefined && message.html === undefined) {
    return Effect.fail(mailerError("validate", "text or html content is required"));
  }
  return Effect.succeed(from);
};

const send = (
  transporter: Transporter,
  config: SmtpMailerConfig,
  message: MailMessage,
): Effect.Effect<MailDeliveryResult, MailerError, PlatformRuntime> =>
  PlatformRuntime.pipe(
    Effect.andThen(validateMessage(config, message)),
    Effect.flatMap((from) =>
      Effect.tryPromise({
        try: () =>
          transporter.sendMail({
            from: mailbox(from),
            to: message.to.map(mailbox),
            cc: message.cc?.map(mailbox),
            bcc: message.bcc?.map(mailbox),
            replyTo: message.replyTo ? mailbox(message.replyTo) : undefined,
            subject: message.subject,
            text: message.text,
            html: message.html,
            headers: message.headers,
          }),
        catch: (cause) => mailerError("send", cause),
      }),
    ),
    Effect.map((info) => ({
      messageId: info.messageId,
      accepted: (info.accepted as ReadonlyArray<unknown>).map(resultAddress),
      rejected: (info.rejected as ReadonlyArray<unknown>).map(resultAddress),
    })),
  );

const makeMailer = (transporter: Transporter, config: SmtpMailerConfig): MailerShape => ({
  send: (message) => send(transporter, config, message),
});

const makeTransporter = (config: SmtpMailerConfig): Effect.Effect<Transporter, MailerError> => {
  if ((config.username === undefined) !== (config.password === undefined)) {
    return Effect.fail(
      mailerError("configure", "SMTP username and password must be provided together"),
    );
  }
  return Effect.succeed(
    nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? false,
      requireTLS: config.requireTls ?? false,
      auth:
        config.username && config.password
          ? {
              user: config.username,
              pass: Redacted.value(config.password),
            }
          : undefined,
      connectionTimeout: config.connectionTimeoutMillis ?? 10_000,
      greetingTimeout: config.greetingTimeoutMillis ?? 10_000,
      tls: {
        rejectUnauthorized: config.tlsRejectUnauthorized ?? true,
      },
    }),
  );
};

/** SMTP-backed mailer with optional authenticated TLS and startup verification. */
export const SmtpMailerLive = (config: SmtpMailerConfig): Layer.Layer<Mailer, MailerError> =>
  Layer.effect(
    Mailer,
    Effect.acquireRelease(
      makeTransporter(config).pipe(
        Effect.tap((transporter) =>
          config.verifyOnStart
            ? Effect.tryPromise({
                try: () => transporter.verify(),
                catch: (cause) => mailerError("verify", cause),
              }).pipe(Effect.asVoid)
            : Effect.void,
        ),
      ),
      (transporter) => Effect.sync(() => transporter.close()),
    ).pipe(Effect.map((transporter) => makeMailer(transporter, config))),
  );
