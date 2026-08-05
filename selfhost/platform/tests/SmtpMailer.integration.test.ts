import { Mailer, MailerError } from "@voidhash/platform/Mailer";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { SmtpMailerLive, type SmtpMailerConfig } from "../src/Mailer.ts";
import { SelfhostPlatformRuntimeLive } from "../src/PlatformRuntime.ts";

const config: SmtpMailerConfig = {
  host: process.env.PLATFORM_SELFHOST_SMTP_HOST ?? "127.0.0.1",
  port: Number(process.env.PLATFORM_SELFHOST_SMTP_PORT ?? "1025"),
  defaultFrom: { address: "noreply@voidhash.local", name: "Voidhash" },
  verifyOnStart: true,
};

const mailerLayer = (input: SmtpMailerConfig = config) =>
  Layer.merge(SmtpMailerLive(input), SelfhostPlatformRuntimeLive);
const mailpitApi = process.env.PLATFORM_SELFHOST_MAILPIT_API ?? "http://127.0.0.1:8025";

interface MailpitMessageSummary {
  readonly ID: string;
  readonly Subject: string;
}

interface MailpitMessages {
  readonly messages: ReadonlyArray<MailpitMessageSummary>;
}

interface MailpitMessage {
  readonly From: { readonly Address: string };
  readonly To: ReadonlyArray<{ readonly Address: string }>;
  readonly ReplyTo: ReadonlyArray<{ readonly Address: string }>;
  readonly Text: string;
  readonly HTML: string;
}

describe("SMTP mailer", () => {
  it("delivers structured text and HTML through SMTP", async () => {
    const subject = `SMTP integration ${crypto.randomUUID()}`;
    const delivery = await Effect.runPromise(
      Effect.gen(function* () {
        const mailer = yield* Mailer;
        return yield* mailer.send({
          to: [{ address: "person@example.com", name: "Example Person" }],
          replyTo: { address: "support@voidhash.local", name: "Support" },
          subject,
          text: "Plain body",
          html: "<strong>HTML body</strong>",
          headers: { "X-Voidhash-Test": "smtp" },
        });
      }).pipe(Effect.provide(mailerLayer())),
    );

    expect(delivery.messageId).toBeTypeOf("string");
    expect(delivery.accepted).toContain("person@example.com");
    expect(delivery.rejected).toEqual([]);

    const messagesResponse = await fetch(`${mailpitApi}/api/v1/messages`);
    expect(messagesResponse.ok).toBe(true);
    const messages = (await messagesResponse.json()) as MailpitMessages;
    const messageId = messages.messages.find((message) => message.Subject === subject)?.ID;
    expect(messageId).toBeTypeOf("string");

    const [messageResponse, headersResponse] = await Promise.all([
      fetch(`${mailpitApi}/api/v1/message/${messageId}`),
      fetch(`${mailpitApi}/api/v1/message/${messageId}/headers`),
    ]);
    expect(messageResponse.ok).toBe(true);
    expect(headersResponse.ok).toBe(true);

    const message = (await messageResponse.json()) as MailpitMessage;
    const headers = (await headersResponse.json()) as Record<string, ReadonlyArray<string>>;
    expect(message.From.Address).toBe("noreply@voidhash.local");
    expect(message.To.map(({ Address }) => Address)).toEqual(["person@example.com"]);
    expect(message.ReplyTo.map(({ Address }) => Address)).toEqual(["support@voidhash.local"]);
    expect(message.Text).toBe("Plain body");
    expect(message.HTML).toBe("<strong>HTML body</strong>");
    expect(headers["X-Voidhash-Test"]).toEqual(["smtp"]);
  });

  it("validates message content through the stable error channel", async () => {
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const mailer = yield* Mailer;
        return yield* mailer
          .send({ to: [], subject: "invalid" })
          .pipe(Effect.flip);
      }).pipe(Effect.provide(mailerLayer({ ...config, verifyOnStart: false }))),
    );

    expect(error).toBeInstanceOf(MailerError);
    expect(error.operation).toBe("validate");
  });

  it("maps SMTP connection failures during startup verification", async () => {
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        return yield* Mailer;
      }).pipe(
        Effect.provide(
          mailerLayer({
            ...config,
            port: 1,
            connectionTimeoutMillis: 200,
          }),
        ),
        Effect.flip,
      ),
    );

    expect(error).toBeInstanceOf(MailerError);
    expect(error.operation).toBe("verify");
  });

  it("rejects incomplete SMTP authentication configuration", async () => {
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        return yield* Mailer;
      }).pipe(
        Effect.provide(
          mailerLayer({
            ...config,
            username: "user",
            password: undefined,
          }),
        ),
        Effect.flip,
      ),
    );

    expect(error).toBeInstanceOf(MailerError);
    expect(error.operation).toBe("configure");
  });
});
