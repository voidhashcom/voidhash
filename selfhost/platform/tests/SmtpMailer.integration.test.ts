import { Mailer, MailerError } from "@voidhash/platform/Mailer";
import { Config, Effect, Layer, Random, Schema } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import { describe, expect, it } from "vitest";

import { SmtpMailerLive, type SmtpMailerConfig } from "../src/Mailer.ts";
import { SelfhostPlatformRuntimeLive } from "../src/PlatformRuntime.ts";

const readConfig = Effect.gen(function* () {
  const config: SmtpMailerConfig = {
    host: yield* Config.string("PLATFORM_SELFHOST_SMTP_HOST").pipe(
      Config.withDefault("127.0.0.1"),
    ),
    port: yield* Config.int("PLATFORM_SELFHOST_SMTP_PORT").pipe(Config.withDefault(1025)),
    defaultFrom: { address: "noreply@voidhash.local", name: "Voidhash" },
    verifyOnStart: true,
  };
  return config;
}).pipe(Effect.orDie);

const mailerLayer = (adjust: (config: SmtpMailerConfig) => SmtpMailerConfig = (input) => input) =>
  Layer.unwrap(
    readConfig.pipe(
      Effect.map((config) =>
        Layer.merge(SmtpMailerLive(adjust(config)), SelfhostPlatformRuntimeLive),
      ),
    ),
  );

const mailpitApi = Config.string("PLATFORM_SELFHOST_MAILPIT_API").pipe(
  Config.withDefault("http://127.0.0.1:8025"),
  Effect.orDie,
);

const uniqueSuffix = Effect.gen(function* () {
  const high = yield* Random.nextInt;
  const low = yield* Random.nextInt;
  return `${high.toString(36)}${low.toString(36)}`;
});

const isOk = (status: number): boolean => status >= 200 && status < 300;

const Address = Schema.Struct({ Address: Schema.String });

const decodeMessages = Schema.decodeUnknownEffect(
  Schema.Struct({
    messages: Schema.Array(Schema.Struct({ ID: Schema.String, Subject: Schema.String })),
  }),
);

const decodeMessage = Schema.decodeUnknownEffect(
  Schema.Struct({
    From: Address,
    To: Schema.Array(Address),
    ReplyTo: Schema.Array(Address),
    Text: Schema.String,
    HTML: Schema.String,
  }),
);

const decodeHeaders = Schema.decodeUnknownEffect(
  Schema.Record(Schema.String, Schema.Array(Schema.String)),
);

describe("SMTP mailer", () => {
  it("delivers structured text and HTML through SMTP", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const api = yield* mailpitApi;
        const subject = `SMTP integration ${yield* uniqueSuffix}`;
        const delivery = yield* Effect.gen(function* () {
          const mailer = yield* Mailer;
          return yield* mailer.send({
            to: [{ address: "person@example.com", name: "Example Person" }],
            replyTo: { address: "support@voidhash.local", name: "Support" },
            subject,
            text: "Plain body",
            html: "<strong>HTML body</strong>",
            headers: { "X-Voidhash-Test": "smtp" },
          });
        }).pipe(Effect.provide(mailerLayer()));

        expect(delivery.messageId).toBeTypeOf("string");
        expect(delivery.accepted).toContain("person@example.com");
        expect(delivery.rejected).toEqual([]);

        const client = yield* HttpClient.HttpClient;
        const messagesResponse = yield* client.get(`${api}/api/v1/messages`);
        expect(isOk(messagesResponse.status)).toBe(true);
        const messages = yield* decodeMessages(yield* messagesResponse.json);
        const messageId = messages.messages.find((message) => message.Subject === subject)?.ID;
        expect(messageId).toBeTypeOf("string");

        const [messageResponse, headersResponse] = yield* Effect.all(
          [
            client.get(`${api}/api/v1/message/${messageId}`),
            client.get(`${api}/api/v1/message/${messageId}/headers`),
          ],
          { concurrency: "unbounded" },
        );
        expect(isOk(messageResponse.status)).toBe(true);
        expect(isOk(headersResponse.status)).toBe(true);

        const message = yield* decodeMessage(yield* messageResponse.json);
        const headers = yield* decodeHeaders(yield* headersResponse.json);
        expect(message.From.Address).toBe("noreply@voidhash.local");
        expect(message.To.map(({ Address: address }) => address)).toEqual(["person@example.com"]);
        expect(message.ReplyTo.map(({ Address: address }) => address)).toEqual([
          "support@voidhash.local",
        ]);
        expect(message.Text).toBe("Plain body");
        expect(message.HTML).toBe("<strong>HTML body</strong>");
        expect(headers["X-Voidhash-Test"]).toEqual(["smtp"]);
      }).pipe(Effect.provide(FetchHttpClient.layer)),
    ));

  it("validates message content through the stable error channel", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const error = yield* Effect.gen(function* () {
          const mailer = yield* Mailer;
          return yield* mailer.send({ to: [], subject: "invalid" }).pipe(Effect.flip);
        }).pipe(
          Effect.provide(mailerLayer((config) => ({ ...config, verifyOnStart: false }))),
        );

        expect(error).toBeInstanceOf(MailerError);
        expect(error.operation).toBe("validate");
      }),
    ));

  it("maps SMTP connection failures during startup verification", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const error = yield* Effect.gen(function* () {
          return yield* Mailer;
        }).pipe(
          Effect.provide(
            mailerLayer((config) => ({ ...config, port: 1, connectionTimeoutMillis: 200 })),
          ),
          Effect.flip,
        );

        expect(error).toBeInstanceOf(MailerError);
        expect(error.operation).toBe("verify");
      }),
    ));

  it("rejects incomplete SMTP authentication configuration", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const error = yield* Effect.gen(function* () {
          return yield* Mailer;
        }).pipe(
          Effect.provide(
            mailerLayer((config) => ({ ...config, username: "user", password: undefined })),
          ),
          Effect.flip,
        );

        expect(error).toBeInstanceOf(MailerError);
        expect(error.operation).toBe("configure");
      }),
    ));
});
