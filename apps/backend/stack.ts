import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Output from "alchemy/Output";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

import { DatabaseHyperdrive } from "./infrastructure/Hyperdrive.ts";
import { PaywallArtifactsBucket } from "./r2/PaywallArtifactsBucket.ts";
import { PublicFileStorageBucket } from "./r2/PublicFileStorageBucket.ts";
import { CommunityWebsite } from "./workers/WwwWorker.ts";
import CommunityBackend from "./workers/BackendWorker.ts";
import MimicDbWorker, { MIMIC_DB_DEV_PORT } from "./workers/MimicDbWorker.ts";

class CommunityStackConfigurationError extends Schema.TaggedErrorClass<CommunityStackConfigurationError>(
  "CommunityStackConfigurationError",
)("CommunityStackConfigurationError", { message: Schema.String }) {}

const dieOnBlankWwwOrigin = (): never => {
  throw new CommunityStackConfigurationError({
    message: "www origin resolved empty — refusing to bind a blank CORS_ORIGINS on mimic-db",
  });
};

/** Resolved Community Cloudflare deployment outputs. */
export interface CommunityStackOutput {
  readonly backendUrl: string;
  readonly hyperdriveId: string;
  readonly mimicDbUrl: string;
  readonly wwwUrl: string;
}

const stackState = Layer.unwrap(
  Alchemy.AlchemyContext.pipe(
    Effect.map((context) => {
      if (context.dev) return Alchemy.localState();
      return Cloudflare.state();
    }),
  ),
);

export default Alchemy.Stack(
  "VoidhashCommunity",
  {
    providers: Cloudflare.providers(),
    state: stackState,
  },
  Effect.gen(function* () {
    const { stage } = yield* Alchemy.Stack;
    const dev = Option.match(yield* Effect.serviceOption(Alchemy.AlchemyContext), {
      onNone: () => false,
      onSome: (context) => context.dev,
    });
    const isEphemeral = stage !== "production" && stage !== "preview";
    const hyperdrive = yield* DatabaseHyperdrive;
    yield* PaywallArtifactsBucket;
    yield* PublicFileStorageBucket;
    const backend = yield* CommunityBackend;
    const mimicDb = yield* MimicDbWorker;
    yield* backend.bind`MimicHostServiceBinding`({
      bindings: [
        {
          type: "service",
          name: "MIMIC_HOST",
          service: mimicDb.workerName,
        },
      ],
    });
    const www = yield* CommunityWebsite({ apiUrl: backend.url.as<string>() });

    if (!dev) {
      yield* mimicDb.bind`MimicPublicBaseUrl`({
        bindings: [
          {
            type: "plain_text",
            name: "MIMIC_PUBLIC_BASE_URL",
            text: Output.map(mimicDb.url, (url) => url ?? ""),
          },
        ],
      });
    }

    const mimicRootPassword = yield* Config.redacted("MIMIC_ROOT_PASSWORD").pipe(
      Config.withDefault(Redacted.make("")),
      Effect.flatMap((password) => {
        if (Redacted.value(password) !== "") return Effect.succeed(password);
        if (isEphemeral) return Effect.succeed(Redacted.make("password"));
        return Effect.die(
          new CommunityStackConfigurationError({
            message: "MIMIC_ROOT_PASSWORD must be set for production/preview deploys",
          }),
        );
      }),
    );
    const resolveMimicCorsOrigins = () => {
      if (dev) {
        return [
          "http://localhost:3000",
          "http://localhost:5173",
          "http://localhost:4173",
          "http://localhost:4460",
          "http://localhost:3003",
        ].join(",");
      }
      return Output.map(www.url, (url) => {
        const origin = (url ?? "").replace(/\/+$/, "");
        if (origin === "" && !isEphemeral) return dieOnBlankWwwOrigin();
        return origin;
      });
    };
    const mimicCorsOrigins = resolveMimicCorsOrigins();
    const resolveMimicDbUrl = () => {
      if (dev) return `http://localhost:${MIMIC_DB_DEV_PORT}`;
      return Output.map(mimicDb.url, (url) => url ?? "");
    };

    yield* mimicDb.bind`MimicDbSecurity`({
      bindings: [
        {
          type: "secret_text",
          name: "ROOT_PASSWORD",
          text: Redacted.value(mimicRootPassword),
        },
        { type: "plain_text", name: "CORS_ORIGINS", text: mimicCorsOrigins },
      ],
    });
    yield* backend.bind`MimicDbCredentials`({
      bindings: [
        {
          type: "plain_text",
          name: "MIMIC_DB_URL",
          text: resolveMimicDbUrl(),
        },
        {
          type: "secret_text",
          name: "MIMIC_ROOT_PASSWORD",
          text: Redacted.value(mimicRootPassword),
        },
      ],
    });

    return {
      backendUrl: backend.url,
      hyperdriveId: hyperdrive.hyperdriveId,
      mimicDbUrl: mimicDb.url,
      wwwUrl: www.url,
    };
  }),
);
