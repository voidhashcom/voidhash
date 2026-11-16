/**
 * `voidhash provider connect <store>`: saves what a store needs and enables
 * it, asking for each value on a terminal and reading key files from disk.
 * Running it again for a connected store changes its settings; values not
 * given keep what is saved, credentials included.
 */
import type { PaymentProviderJsonEncoding, PaymentProviderType } from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import { Command, Flag, Prompt } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { apiError, ExitCode, userError } from "../../utils/error-formatter";
import { readCliConfig, resolveProject } from "../context";
import { isInteractive, requireText } from "../input";
import { outputModeOf, printItem } from "../output";
import { outputOptions, projectOption } from "../shared-options";
import { slugFrom, storeLabel } from "./catalog";
import {
  newSigningSecret,
  notificationTarget,
  providerHandle,
  providerLabel,
  STORED_SECRET,
} from "./providers";

/** One value a store needs: where it is saved, the flag that gives it, and how to ask for it. */
interface Field {
  /** Where it is saved in the provider's configuration: `["live", "secretKey"]`. */
  readonly path: ReadonlyArray<string>;
  readonly flag: string;
  readonly given: Option.Option<string>;
  /** What the prompt asks. */
  readonly message: string;
  /** A secret is typed hidden; a file is read from the path given. */
  readonly kind: "text" | "secret" | "file";
  /** The value when none is given or saved; a field without one is required. */
  readonly fallback?: string;
  /** Left out when none is given or saved, such as the credentials of a Stripe mode not used. */
  readonly optional?: boolean;
  /** A default worked out from the values before it, such as a key id from its file name. */
  readonly derive?: (values: Readonly<Record<string, string>>) => Option.Option<string>;
}

/** The values found so far, the configuration they make, and the fields still missing. */
interface Resolution {
  readonly configuration: Record<string, unknown>;
  readonly values: Readonly<Record<string, string>>;
  readonly deferred: ReadonlyArray<Field>;
}

/**
 * A set of credentials that works on its own, such as Stripe's test mode:
 * the field that turns it on, and the fields it then needs.
 */
interface CredentialMode {
  readonly key: string;
  readonly needs: ReadonlyArray<string>;
}

const pathKey = (path: ReadonlyArray<string>) => path.join(".");

const valueAt = (configuration: Record<string, unknown>, path: ReadonlyArray<string>) => {
  const start: unknown = configuration;
  const found = Arr.reduce(path, start, (current, segment) =>
    P.isObject(current) && P.hasProperty(current, segment) ? current[segment] : undefined,
  );
  return P.isString(found) && found !== "" ? Option.some(found) : Option.none();
};

const withValueAt = (
  configuration: Record<string, unknown>,
  path: ReadonlyArray<string>,
  value: string,
): Record<string, unknown> => {
  const [head, ...rest] = path;
  if (head === undefined) return configuration;
  if (Arr.isReadonlyArrayEmpty(rest)) return { ...configuration, [head]: value };
  const inner = configuration[head];
  return {
    ...configuration,
    [head]: withValueAt(P.isObject(inner) ? { ...inner } : {}, rest, value),
  };
};

const readKeyFile = (path: string, flag: string) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const text = yield* fileSystem.readFileString(path).pipe(
      Effect.mapError(() =>
        userError(`Could not read ${path}, given to ${flag}.`, {
          hint: "Pass the path of the key file you downloaded.",
          exitCode: ExitCode.usage,
        }),
      ),
    );
    return text.trim();
  });

/**
 * A field's value: the flag, else what the person types on a terminal (a
 * saved credential is kept by pressing Enter), else what is saved, derived
 * or defaulted. None when a required value is missing off a terminal.
 */
const resolveField = (
  field: Field,
  saved: Option.Option<string>,
  values: Readonly<Record<string, string>>,
  interactive: boolean,
) =>
  Effect.gen(function* () {
    if (Option.isSome(field.given)) {
      return Option.some(
        field.kind === "file"
          ? yield* readKeyFile(field.given.value, field.flag)
          : field.given.value,
      );
    }
    const derived = field.derive === undefined ? Option.none<string>() : field.derive(values);
    const isStored = Option.contains(saved, STORED_SECRET);
    if (!interactive) {
      return Option.orElse(
        Option.orElse(saved, () => derived),
        () => Option.fromNullishOr(field.fallback),
      );
    }
    if (field.kind === "secret") {
      const typed = Redacted.value(
        yield* Prompt.run(
          Prompt.Hidden({
            message: `${field.message}${isStored ? " (Enter keeps the saved one)" : field.optional === true ? " (Enter skips)" : ""}`,
            validate: (text) =>
              text.trim() === "" && !isStored && field.optional !== true
                ? Effect.fail("Type a value.")
                : Effect.succeed(text.trim()),
          }),
        ),
      );
      if (typed !== "") return Option.some(typed);
      return isStored ? Option.some(STORED_SECRET) : Option.none();
    }
    const initial =
      field.kind === "file"
        ? undefined
        : Option.getOrUndefined(
            Option.orElse(
              Option.orElse(saved, () => derived),
              () => Option.fromNullishOr(field.fallback),
            ),
          );
    const typed = yield* Prompt.run(
      Prompt.String({
        message: `${field.message}${field.kind === "file" && isStored ? " (Enter keeps the saved key)" : ""}`,
        ...(initial === undefined ? {} : { default: initial }),
        validate: (text) =>
          text.trim() === "" && field.fallback === undefined && !(field.kind === "file" && isStored)
            ? Effect.fail("Type a value.")
            : Effect.succeed(text.trim()),
      }),
    );
    if (field.kind === "file") {
      return Option.some(typed === "" ? STORED_SECRET : yield* readKeyFile(typed, field.flag));
    }
    return Option.some(typed === "" ? (field.fallback ?? "") : typed);
  });

/** The key id in an App Store Connect key file name: `AuthKey_ABC123DEF4.p8` is `ABC123DEF4`. */
const keyIdFromFileName = (flagValue: Option.Option<string>) =>
  Option.flatMap(flagValue, (path) =>
    Option.fromNullishOr(/(?:AuthKey|SubscriptionKey|ApiKey)_([A-Z0-9]+)\.p8$/.exec(path)?.[1]),
  );

/**
 * Saves `fields` into the project's provider of `type` and enables it. The
 * provider is added first when the project has none, so the notification
 * address that names it can be shown before the values that need it.
 * `modes` are credential sets of which at least one is needed, such as
 * Stripe's live and test mode; the fields a mode then needs may come in a
 * later run: the settings are saved without enabling the provider.
 */
const connectStore = (options: {
  readonly type: Exclude<PaymentProviderType, "payment_source">;
  readonly project: Option.Option<string>;
  readonly fields: ReadonlyArray<Field>;
  readonly defaults: Record<string, unknown>;
  readonly usage: string;
  readonly modes?: ReadonlyArray<CredentialMode>;
  readonly mode: "human" | "json" | "quiet";
}) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    const projectId = (yield* resolveProject(options.project)).project.id;
    const interactive = yield* isInteractive;
    const providers = yield* readAll((query) =>
      api.paymentProvidersList(projectId, { ...query, type: options.type }),
    );
    const existing = Arr.head(providers);
    const savedConfiguration = Option.match(existing, {
      onNone: () => options.defaults,
      onSome: (provider) => ({ ...options.defaults, ...provider.configuration }),
    });
    const modes = options.modes ?? [];
    const fieldAt = (key: string) => options.fields.find((field) => pathKey(field.path) === key);
    const noModeError = userError(
      `Missing ${modes.flatMap(({ key }) => Arr.fromNullishOr(fieldAt(key)?.flag)).join(" or ")}.`,
      {
        hint: `Give the credentials of at least one mode: ${options.usage}`,
        exitCode: ExitCode.usage,
      },
    );

    // Off a terminal, find what is missing before changing anything.
    if (!interactive) {
      const missing = options.fields.filter(
        (field) =>
          Option.isNone(field.given) &&
          Option.isNone(valueAt(savedConfiguration, field.path)) &&
          field.fallback === undefined &&
          field.optional !== true &&
          Option.isNone(field.derive?.({}) ?? Option.none()),
      );
      const hasMode =
        Arr.isReadonlyArrayEmpty(modes) ||
        modes.some(({ key }) => {
          const field = fieldAt(key);
          return (
            field !== undefined &&
            (Option.isSome(field.given) || Option.isSome(valueAt(savedConfiguration, field.path)))
          );
        });
      if (Arr.isReadonlyArrayEmpty(missing) && !hasMode) return yield* Effect.fail(noModeError);
      if (Arr.isReadonlyArrayNonEmpty(missing)) {
        return yield* Effect.fail(
          userError(`Missing ${missing.map((field) => field.flag).join(", ")}.`, {
            hint: `There is no terminal to ask in; run it as: ${options.usage}`,
            exitCode: ExitCode.usage,
          }),
        );
      }
    }

    const provider = yield* Option.match(existing, {
      onSome: Effect.succeed,
      onNone: () => api.paymentProvidersCreate(projectId, { type: options.type }),
    });
    const { api_url } = yield* readCliConfig;
    const target = notificationTarget(api_url, provider);
    if (interactive && options.mode === "human") {
      yield* Console.error(
        Option.match(target, {
          onNone: () => `Connecting ${storeLabel(provider)}.`,
          onSome: ({ url, where }) => `Connecting ${storeLabel(provider)}. Set ${url} as ${where}.`,
        }),
      );
    }

    const resolved = yield* Effect.reduce(
      options.fields,
      (): Resolution => ({ configuration: savedConfiguration, values: {}, deferred: [] }),
      (state, field) =>
        Effect.map(
          resolveField(field, valueAt(savedConfiguration, field.path), state.values, interactive),
          Option.match({
            onNone: (): Resolution =>
              field.optional === true ? state : { ...state, deferred: [...state.deferred, field] },
            onSome: (value): Resolution => ({
              configuration: withValueAt(state.configuration, field.path, value),
              values: { ...state.values, [pathKey(field.path)]: value },
              deferred: state.deferred,
            }),
          }),
        ),
    );
    const { configuration } = resolved;
    const activeModes = modes.filter(({ key }) =>
      Option.isSome(valueAt(configuration, key.split("."))),
    );
    if (Arr.isReadonlyArrayNonEmpty(modes) && Arr.isReadonlyArrayEmpty(activeModes)) {
      return yield* Effect.fail(noModeError);
    }
    const deferred = [
      ...resolved.deferred,
      ...activeModes.flatMap(({ needs }) =>
        options.fields.filter(
          (field) =>
            needs.includes(pathKey(field.path)) &&
            Option.isNone(valueAt(configuration, field.path)),
        ),
      ),
    ];
    const isComplete = Arr.isReadonlyArrayEmpty(deferred);
    const saved = yield* api
      .paymentProvidersUpdate(projectId, provider.id, { configuration, isEnabled: isComplete })
      .pipe(
        Effect.mapError((error) =>
          apiError(error, {
            invalid_payment_provider_configuration: `Nothing was enabled. Fix that value, then run '${options.usage}' again; '--help' says what each flag is.`,
            payment_provider_key_taken:
              "Another provider of this project is set up for this app or account: 'voidhash-cli provider list' shows it.",
          }),
        ),
      );
    yield* printItem(options.mode, saved, connectedMessage(saved, target, deferred));
  });

const connectedMessage = (
  provider: PaymentProviderJsonEncoding,
  target: Option.Option<{ readonly url: string; readonly where: string }>,
  deferred: ReadonlyArray<Field>,
) => {
  const handle = providerHandle(provider);
  const notifications = Arr.fromOption(
    Option.map(target, ({ url, where }) => `  Set ${url} as ${where}.`),
  );
  if (Arr.isReadonlyArrayNonEmpty(deferred)) {
    return [
      `Saved ${providerLabel(provider)}, but it is not enabled yet: it needs ${deferred.map((field) => field.flag).join(", ")}.`,
      ...notifications,
      `  Then run 'voidhash-cli provider connect ${handle} ${deferred.map((field) => `${field.flag} <value>`).join(" ")}'.`,
    ].join("\n");
  }
  return [
    `Connected ${providerLabel(provider)}; Voidhash checked its credentials.`,
    "Next:",
    ...notifications,
    `  Map its store products to products: 'voidhash-cli provider products ${handle} --unmapped', then 'voidhash-cli provider map <store-product> <product>'.`,
    ...(provider.type === "stripe"
      ? ["  Import its earlier purchases: 'voidhash-cli provider import stripe'."]
      : []),
  ].join("\n");
};

const text = (name: string, description: string) =>
  Flag.String(name).pipe(Flag.withDescription(description), Flag.optional);

const forwardingFlag = text(
  "forward-notifications-to",
  "Also forward the store's notifications to this HTTPS URL, such as your own server",
);

const APP_STORE_USAGE =
  "voidhash-cli provider connect app-store --bundle-id <id> --apple-id <number> --issuer-id <id> --iap-key <SubscriptionKey_….p8> --api-key <AuthKey_….p8> --vendor-number <number>";

/** `voidhash-cli provider connect app-store` */
const connectAppStoreCommand = Command.make(
  "app-store",
  {
    bundleId: text("bundle-id", "The app's bundle id, such as com.acme.app"),
    appleId: text("apple-id", "The app's Apple ID: the number in its App Store Connect address"),
    issuerId: text(
      "issuer-id",
      "The issuer id of your App Store Connect keys (Users and Access, Integrations)",
    ),
    iapKey: text("iap-key", "The In-App Purchase key file (SubscriptionKey_….p8)"),
    iapKeyId: text("iap-key-id", "Its key id (default: from the file name)"),
    apiKey: text("api-key", "The App Store Connect API key file (AuthKey_….p8)"),
    apiKeyId: text("api-key-id", "Its key id (default: from the file name)"),
    vendorNumber: text("vendor-number", "Your vendor number, from Payments and Financial Reports"),
    forward: forwardingFlag,
    project: projectOption,
    ...outputOptions,
  },
  (flags) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf(flags);
      const fields: ReadonlyArray<Field> = [
        {
          path: ["bundleId"],
          flag: "--bundle-id",
          given: flags.bundleId,
          message: "Bundle id",
          kind: "text",
        },
        {
          path: ["appAppleId"],
          flag: "--apple-id",
          given: flags.appleId,
          message: "Apple ID of the app (a number)",
          kind: "text",
        },
        {
          path: ["inAppPurchaseKeyIssuerId"],
          flag: "--issuer-id",
          given: flags.issuerId,
          message: "Issuer id of your App Store Connect keys",
          kind: "text",
        },
        {
          path: ["inAppPurchasePrivateKey"],
          flag: "--iap-key",
          given: flags.iapKey,
          message: "Path of the In-App Purchase key file (SubscriptionKey_….p8)",
          kind: "file",
        },
        {
          path: ["inAppPurchaseKeyId"],
          flag: "--iap-key-id",
          given: Option.orElse(flags.iapKeyId, () => keyIdFromFileName(flags.iapKey)),
          message: "Its key id",
          kind: "text",
        },
        {
          path: ["appStoreConnectApiIssuerId"],
          flag: "--issuer-id",
          given: flags.issuerId,
          message: "Issuer id of the App Store Connect API key",
          kind: "text",
          derive: (values) => Option.fromNullishOr(values["inAppPurchaseKeyIssuerId"]),
        },
        {
          path: ["appStoreConnectApiPrivateKey"],
          flag: "--api-key",
          given: flags.apiKey,
          message: "Path of the App Store Connect API key file (AuthKey_….p8)",
          kind: "file",
        },
        {
          path: ["appStoreConnectApiKeyId"],
          flag: "--api-key-id",
          given: Option.orElse(flags.apiKeyId, () => keyIdFromFileName(flags.apiKey)),
          message: "Its key id",
          kind: "text",
        },
        {
          path: ["appStoreConnectApiVendorNumber"],
          flag: "--vendor-number",
          given: flags.vendorNumber,
          message: "Vendor number",
          kind: "text",
        },
        {
          path: ["appleServerNotificationForwardingUrl"],
          flag: "--forward-notifications-to",
          given: flags.forward,
          message: "Forward Apple's notifications to (optional)",
          kind: "text",
          fallback: "",
        },
      ];
      yield* connectStore({
        type: "app_store",
        project: flags.project,
        fields,
        defaults: {
          appleServerNotificationForwardingUrl: "",
          appleSmallBusinessProgramHasEndDate: false,
          trackNewPurchasesFromAppleServerNotifications: true,
        },
        usage: APP_STORE_USAGE,
        mode,
      });
    }),
).pipe(
  Command.withDescription(
    "Connect the App Store: the app's ids and its In-App Purchase and App Store Connect API keys, read from their .p8 files. Asks for what is missing in a terminal; run it again to change them.",
  ),
);

const GOOGLE_PLAY_USAGE =
  "voidhash-cli provider connect google-play --package-name <name> --service-account-key <file.json>";

/** `voidhash-cli provider connect google-play` */
const connectGooglePlayCommand = Command.make(
  "google-play",
  {
    packageName: text("package-name", "The app's package name, such as com.acme.app"),
    serviceAccountKey: text(
      "service-account-key",
      "The JSON key file of a Google Cloud service account with access to the app in Play Console",
    ),
    topic: text(
      "notifications-topic",
      "The Pub/Sub topic of its real-time developer notifications, projects/<project>/topics/<topic>",
    ),
    forward: forwardingFlag,
    project: projectOption,
    ...outputOptions,
  },
  (flags) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf(flags);
      yield* connectStore({
        type: "google_play",
        project: flags.project,
        fields: [
          {
            path: ["packageName"],
            flag: "--package-name",
            given: flags.packageName,
            message: "Package name",
            kind: "text",
          },
          {
            path: ["serviceAccountKey"],
            flag: "--service-account-key",
            given: flags.serviceAccountKey,
            message: "Path of the service account's JSON key file",
            kind: "file",
          },
          {
            path: ["googleRealTimeDeveloperNotificationTopicName"],
            flag: "--notifications-topic",
            given: flags.topic,
            message: "Pub/Sub topic of its notifications (optional)",
            kind: "text",
            fallback: "",
          },
          {
            path: ["googleRealTimeDeveloperNotificationForwardingUrl"],
            flag: "--forward-notifications-to",
            given: flags.forward,
            message: "Forward Google's notifications to (optional)",
            kind: "text",
            fallback: "",
          },
        ],
        defaults: {},
        usage: GOOGLE_PLAY_USAGE,
        mode,
      });
    }),
).pipe(
  Command.withDescription(
    "Connect Google Play: the app's package name and a service account key, read from its JSON file. Asks for what is missing in a terminal; run it again to change them.",
  ),
);

const STRIPE_USAGE =
  "voidhash-cli provider connect stripe --account-id <acct_…> [--live-secret-key <sk_live_…> --live-webhook-secret <whsec_…>] [--test-secret-key <sk_test_…> --test-webhook-secret <whsec_…>]";

/** `voidhash-cli provider connect stripe` */
const connectStripeCommand = Command.make(
  "stripe",
  {
    accountId: text("account-id", "Your Stripe account id, acct_…"),
    liveSecretKey: text(
      "live-secret-key",
      "A live secret or restricted key, sk_live_… or rk_live_…; leave out to connect test mode only",
    ),
    testSecretKey: text(
      "test-secret-key",
      "A test secret or restricted key, sk_test_… or rk_test_…; leave out to connect live mode only",
    ),
    liveWebhookSecret: text(
      "live-webhook-secret",
      "The signing secret of the live webhook endpoint pointing at Voidhash, whsec_…",
    ),
    testWebhookSecret: text(
      "test-webhook-secret",
      "The signing secret of the test webhook endpoint pointing at Voidhash, whsec_…",
    ),
    project: projectOption,
    ...outputOptions,
  },
  (flags) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf(flags);
      yield* connectStore({
        type: "stripe",
        project: flags.project,
        fields: [
          {
            path: ["accountId"],
            flag: "--account-id",
            given: flags.accountId,
            message: "Stripe account id (acct_…)",
            kind: "text",
          },
          {
            path: ["live", "secretKey"],
            flag: "--live-secret-key",
            given: flags.liveSecretKey,
            message: "Live secret key (sk_live_… or rk_live_…)",
            kind: "secret",
            optional: true,
          },
          {
            path: ["test", "secretKey"],
            flag: "--test-secret-key",
            given: flags.testSecretKey,
            message: "Test secret key (sk_test_… or rk_test_…)",
            kind: "secret",
            optional: true,
          },
          {
            path: ["live", "webhookSecret"],
            flag: "--live-webhook-secret",
            given: flags.liveWebhookSecret,
            message: "Live webhook signing secret (whsec_…)",
            kind: "secret",
            optional: true,
          },
          {
            path: ["test", "webhookSecret"],
            flag: "--test-webhook-secret",
            given: flags.testWebhookSecret,
            message: "Test webhook signing secret (whsec_…)",
            kind: "secret",
            optional: true,
          },
        ],
        defaults: {},
        usage: STRIPE_USAGE,
        // Live mode, test mode or both. The webhook endpoints point at an address
        // that names the provider, so their secrets can come in a second run.
        modes: [
          { key: "live.secretKey", needs: ["live.webhookSecret"] },
          { key: "test.secretKey", needs: ["test.webhookSecret"] },
        ],
        mode,
      });
    }),
).pipe(
  Command.withDescription(
    "Connect Stripe: your account id, and for live mode, test mode or both the API key and the signing secret of the webhook endpoint that points at Voidhash. Test mode alone suits a staging setup; its purchases never unlock production. Without the webhook secrets it saves the rest and prints the address to point them at.",
  ),
);

const PAYMENT_SOURCE_USAGE =
  "voidhash-cli provider connect payment-source --name <name> [--slug <slug>] [--endpoint <url>] [--test-endpoint <url>]";

/** `voidhash-cli provider connect payment-source` */
const connectPaymentSourceCommand = Command.make(
  "payment-source",
  {
    name: text("name", "What people see, such as Paddle or Bank transfer"),
    slug: text(
      "slug",
      "How webhooks, analytics and the API name it (default: made from the name); it cannot change",
    ),
    endpoint: text(
      "endpoint",
      "The HTTPS endpoint of its server's Voidhash provider handler, for product lists, history imports, refunds and cancellations",
    ),
    testEndpoint: text(
      "test-endpoint",
      "Another endpoint for test requests only, such as a staging server's; without it test requests go to --endpoint",
    ),
    project: projectOption,
    ...outputOptions,
  },
  ({ endpoint, json, name, project, quiet, slug, testEndpoint }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const sourceName = yield* requireText(name, {
        flag: "--name",
        message: "Name, as people see it",
        usage: PAYMENT_SOURCE_USAGE,
      });
      const sourceSlug =
        Option.isSome(slug) || !(yield* isInteractive)
          ? Option.getOrElse(slug, () => slugFrom(sourceName))
          : yield* requireText(slug, {
              flag: "--slug",
              message: "Slug, which cannot change",
              usage: PAYMENT_SOURCE_USAGE,
              initial: slugFrom(sourceName),
            });
      // Each endpoint has its own signing secret.
      const signingSecret = Option.map(endpoint, () => newSigningSecret());
      const testSigningSecret = Option.map(testEndpoint, () => newSigningSecret());
      const created = yield* api
        .paymentProvidersCreate(projectId, {
          type: "payment_source",
          name: sourceName,
          configuration: {
            slug: sourceSlug,
            ...Option.match(Option.all({ url: endpoint, signingSecret }), {
              onNone: () => ({}),
              onSome: (connected) => ({ endpoint: connected }),
            }),
            ...Option.match(Option.all({ url: testEndpoint, signingSecret: testSigningSecret }), {
              onNone: () => ({}),
              onSome: (connected) => ({ testEndpoint: connected }),
            }),
          },
        })
        .pipe(
          Effect.mapError((error) =>
            apiError(error, {
              payment_provider_exists: `This project already has a payment source ${sourceSlug}: 'voidhash-cli provider view ${sourceSlug}' shows it.`,
            }),
          ),
        );
      const base = `/api/v1/projects/${projectId}/payment-providers/${created.id}`;
      yield* printItem(
        mode,
        created,
        [
          `Created payment source ${providerLabel(created)}.`,
          `Its backend reports payments to PUT ${base}/transactions/{id} and subscriptions to PUT ${base}/subscriptions/{id}, with a secret key that may write purchases.`,
          ...Option.match(signingSecret, {
            onNone: () =>
              Option.isSome(testSigningSecret)
                ? []
                : [
                    `Connect its server's endpoint later with 'voidhash-cli provider edit ${sourceSlug} --endpoint <url>'.`,
                  ],
            onSome: (secret) => [
              `Signing secret for its endpoint, shown once: ${secret}`,
              `Give it to the source's server (for example as VOIDHASH_PROVIDER_SECRET), then run 'voidhash-cli provider test ${sourceSlug}'.`,
            ],
          }),
          ...Option.match(testSigningSecret, {
            onNone: () => [],
            onSome: (secret) => [
              `Signing secret for its test endpoint, shown once: ${secret}`,
              `Give it to the source's test (staging) server (for example as VOIDHASH_PROVIDER_SECRET), then run 'voidhash-cli provider test ${sourceSlug}'.`,
            ],
          }),
          `Next: map its product keys with 'voidhash-cli provider map <product-key> <product> --provider ${sourceSlug}'.`,
        ].join("\n"),
      );
      if (mode !== "human" && Option.isSome(signingSecret)) {
        yield* Console.error(`Signing secret, shown once: ${signingSecret.value}`);
      }
      if (mode !== "human" && Option.isSome(testSigningSecret)) {
        yield* Console.error(
          `Test endpoint signing secret, shown once: ${testSigningSecret.value}`,
        );
      }
    }),
).pipe(
  Command.withDescription(
    "Add a payment source: payments taken outside the stores, such as another payment provider, bank transfers or vouchers, reported by your backend.",
  ),
);

/** `voidhash-cli provider connect …` */
export const providerConnectCommand = Command.make("connect").pipe(
  Command.withDescription(
    "Connect the App Store, Google Play or Stripe with its credentials, or add a payment source. Run it again to change a store's settings.",
  ),
  Command.withSubcommands([
    connectAppStoreCommand,
    connectGooglePlayCommand,
    connectStripeCommand,
    connectPaymentSourceCommand,
  ]),
);
