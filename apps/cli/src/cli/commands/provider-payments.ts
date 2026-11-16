/**
 * The payments of a payment source a person handles by hand: recording one
 * that arrived outside its backend (a bank transfer), refunding a charge and
 * canceling a subscription at the source. The source's own backend reports
 * everything else through the API, so recording subscription states has no
 * command ('voidhash-cli api' reaches it for a one-off correction).
 */
import type {
  PaymentProviderJsonEncoding,
  PaymentSourceTransaction,
} from "@voidhash/generated-clients";
import { getCurrencyMinorUnitExponent } from "@voidhash/lib/constants";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Argument, Command, Flag } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { apiError, ExitCode, userError } from "../../utils/error-formatter";
import { projectKind, resolveProject } from "../context";
import { confirmChange, findItem, missingInput, requireItem } from "../input";
import { formatMoney, outputModeOf, printItem } from "../output";
import { outputOptions, projectOption, yesOption } from "../shared-options";
import { providerHandle, providerKind, providerLabel } from "./providers";

const sourceArgument = Argument.String("source").pipe(
  Argument.withDescription("The payment source: its slug, name or id"),
  Argument.optional,
);

/** Hints for the codes every payment source call can fail with. */
const sourceHints = (handle: string) => ({
  payment_source_disabled: `Enable it first: 'voidhash-cli provider edit ${handle} --enable'.`,
  payment_source_endpoint_not_configured: `Connect its endpoint first: 'voidhash-cli provider edit ${handle} --endpoint <url>'.`,
  payment_source_endpoint_unsupported: `Its server does not implement this; 'voidhash-cli provider test ${handle}' lists what it does.`,
});

/** The payment source a command names; a store it names is a usage error. */
const requireSource = (projectId: string, input: Option.Option<string>, usage: string) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    const providers = yield* readAll((query) => api.paymentProvidersList(projectId, query));
    const sources = providers.filter(({ type }) => type === "payment_source");
    const found: PaymentProviderJsonEncoding = yield* Option.match(input, {
      onSome: (value) => findItem(providerKind, providers, value),
      onNone: () => requireItem(providerKind, sources, input, usage),
    });
    if (found.type !== "payment_source") {
      return yield* Effect.fail(
        userError(`${providerLabel(found)} is a store, not a payment source.`, {
          hint: "Its purchases come from the store; refunds and cancellations happen there.",
          exitCode: ExitCode.usage,
        }),
      );
    }
    return found;
  });

/** An amount typed in major units (`49.00`, `49,5`) in `currency`'s minor units. */
const toMinorUnits = (amount: string, currency: string) => {
  const match = /^(\d+)(?:[.,](\d*))?$/.exec(amount.trim());
  const exponent = getCurrencyMinorUnitExponent(currency);
  const fraction = match?.[2] ?? "";
  const minor = Number(`${match?.[1] ?? ""}${fraction.padEnd(exponent, "0")}`);
  return match === null || fraction.length > exponent || !Number.isSafeInteger(minor)
    ? Effect.fail(
        userError(`${amount} is not an amount of ${currency}.`, {
          hint: `Write it as people do, such as 49.00 (at most ${exponent} decimals).`,
          exitCode: ExitCode.usage,
        }),
      )
    : Effect.succeed(minor);
};

const currencyFlag = Flag.String("currency").pipe(
  Flag.withDescription("ISO 4217 code, such as EUR"),
  Flag.optional,
);

const describeOutcome = (transaction: PaymentSourceTransaction) =>
  transaction.status === "applied"
    ? `applied${transaction.purchaseId === null ? "" : ` to purchase ${transaction.purchaseId}`}`
    : transaction.pendingReason === "product_not_mapped"
      ? "waiting until its product key is mapped ('voidhash-cli provider map')"
      : "waiting until the charge it refunds is recorded";

const RECORD_USAGE =
  "voidhash-cli provider record-payment <source> --amount <49.00> --currency <EUR> --product <key> --distinct-id <id>";

/** `voidhash-cli provider record-payment <source> --amount --currency (--product --distinct-id | --refunds <id>)` */
export const providerRecordPaymentCommand = Command.make(
  "record-payment",
  {
    source: sourceArgument,
    amount: Flag.String("amount").pipe(
      Flag.withDescription("The amount, tax included, as people write it: 49.00"),
      Flag.optional,
    ),
    currency: currencyFlag,
    product: Flag.String("product").pipe(
      Flag.withDescription("The source's product key it pays for"),
      Flag.optional,
    ),
    distinctId: Flag.String("distinct-id").pipe(
      Flag.withDescription("The buyer's distinct id in your app"),
      Flag.optional,
    ),
    customer: Flag.String("customer").pipe(
      Flag.withDescription("The source's id for the buyer, when there is no distinct id"),
      Flag.optional,
    ),
    refunds: Flag.String("refunds").pipe(
      Flag.withDescription("Record a refund of this charge id instead of a charge"),
      Flag.optional,
    ),
    id: Flag.String("id").pipe(
      Flag.withDescription("The transaction's id at the source (default: a new manual-… id)"),
      Flag.optional,
    ),
    at: Flag.String("at").pipe(
      Flag.withDescription("When it happened, ISO 8601 (default: now)"),
      Flag.optional,
    ),
    test: Flag.Boolean("test").pipe(
      Flag.withDescription(
        "A test payment, such as a staging server's; it stays out of production revenue",
      ),
      Flag.withDefault(false),
    ),
    project: projectOption,
    yes: yesOption,
    ...outputOptions,
  },
  (flags) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf(flags);
      const api = yield* ApiClient;
      const context = yield* resolveProject(flags.project);
      const projectId = context.project.id;
      const source = yield* requireSource(projectId, flags.source, RECORD_USAGE);
      const amountText = yield* Option.match(flags.amount, {
        onNone: () => Effect.fail(missingInput("--amount", RECORD_USAGE)),
        onSome: Effect.succeed,
      });
      const currency = yield* Option.match(flags.currency, {
        onNone: () => Effect.fail(missingInput("--currency", RECORD_USAGE)),
        onSome: (code) => Effect.succeed(code.trim().toUpperCase()),
      });
      const amount = yield* toMinorUnits(amountText, currency);
      const isRefund = Option.isSome(flags.refunds);
      if (!isRefund && Option.isNone(flags.product)) {
        return yield* Effect.fail(missingInput("--product", RECORD_USAGE));
      }
      if (!isRefund && Option.isNone(flags.distinctId) && Option.isNone(flags.customer)) {
        return yield* Effect.fail(missingInput("--distinct-id or --customer", RECORD_USAGE));
      }
      const occurredAt = yield* Option.match(flags.at, {
        onNone: () => Effect.map(DateTime.now, DateTime.formatIso),
        onSome: (at) =>
          Option.match(DateTime.make(at), {
            onNone: () =>
              Effect.fail(
                userError(`--at ${at} is not a date and time.`, {
                  hint: "Write it as ISO 8601, such as 2026-10-28T14:00:00Z.",
                  exitCode: ExitCode.usage,
                }),
              ),
            onSome: (time) => Effect.succeed(DateTime.formatIso(time)),
          }),
      });
      const externalId = Option.getOrElse(flags.id, () => `manual-${crypto.randomUUID()}`);
      const money = formatMoney(amount, currency);
      if (isRefund) {
        yield* confirmChange({
          yes: flags.yes,
          message: `Record a refund of ${money} for charge ${Option.getOrElse(flags.refunds, () => "")} at ${providerLabel(source)} in ${projectKind(context.session).label(context.project)}? A refund of all that is left ends the buyer's access.`,
        });
      }
      const recorded = yield* api
        .paymentSourcesUpsertTransaction(projectId, source.id, externalId, {
          type: isRefund ? "refund" : "charge",
          amount,
          currency,
          occurredAt,
          productKey: Option.getOrUndefined(flags.product),
          distinctId: Option.getOrUndefined(flags.distinctId),
          customer: Option.getOrUndefined(
            Option.map(flags.customer, (externalId) => ({ externalId })),
          ),
          refundsTransactionId: Option.getOrUndefined(flags.refunds),
          environment: flags.test ? "test" : "production",
        })
        .pipe(
          Effect.mapError((error) =>
            apiError(error, {
              ...sourceHints(providerHandle(source)),
              transaction_conflict: `${externalId} was recorded with other details; correct it by recording a refund with --refunds ${externalId}.`,
            }),
          ),
        );
      yield* printItem(
        mode,
        recorded,
        `Recorded ${isRefund ? "refund" : "payment"} ${externalId} of ${money} at ${providerLabel(source)}: ${describeOutcome(recorded)}.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Record a payment a payment source took by hand, such as a bank transfer that arrived, or with --refunds a refund of one. An id is recorded once; correct a payment with a refund.",
  ),
);

const REFUND_USAGE = "voidhash-cli provider refund <source> --transaction <id>";

/** `voidhash-cli provider refund <source> --transaction <id> [--amount --currency] [--reason] [--yes]` */
export const providerRefundCommand = Command.make(
  "refund",
  {
    source: sourceArgument,
    transaction: Flag.String("transaction").pipe(
      Flag.withDescription("The charge's id at the source"),
      Flag.optional,
    ),
    amount: Flag.String("amount").pipe(
      Flag.withDescription(
        "Refund only this much, such as 10.00, with --currency (default: all that is left)",
      ),
      Flag.optional,
    ),
    currency: currencyFlag,
    reason: Flag.String("reason").pipe(
      Flag.withDescription("Why, passed to the source"),
      Flag.optional,
    ),
    project: projectOption,
    yes: yesOption,
    ...outputOptions,
  },
  (flags) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf(flags);
      const api = yield* ApiClient;
      const context = yield* resolveProject(flags.project);
      const projectId = context.project.id;
      const source = yield* requireSource(projectId, flags.source, REFUND_USAGE);
      const transaction = yield* Option.match(flags.transaction, {
        onNone: () => Effect.fail(missingInput("--transaction", REFUND_USAGE)),
        onSome: Effect.succeed,
      });
      if (Option.isSome(flags.amount) && Option.isNone(flags.currency)) {
        return yield* Effect.fail(
          userError("--amount needs --currency.", { exitCode: ExitCode.usage }),
        );
      }
      const amount = yield* Option.match(
        Option.all({ amount: flags.amount, currency: flags.currency }),
        {
          onNone: () => Effect.succeedNone,
          onSome: ({ amount, currency }) =>
            Effect.map(toMinorUnits(amount, currency.trim().toUpperCase()), Option.some),
        },
      );
      const how = Option.match(Option.all({ amount, currency: flags.currency }), {
        onNone: () => "everything left of",
        onSome: ({ amount, currency }) =>
          `${formatMoney(amount, currency.trim().toUpperCase())} of`,
      });
      yield* confirmChange({
        yes: flags.yes,
        message: `Refund ${how} charge ${transaction} at ${providerLabel(source)} in ${projectKind(context.session).label(context.project)}? The money goes back to the buyer${Option.isNone(amount) ? " and their access ends" : ""}.`,
      });
      const refund = yield* api
        .paymentSourcesRefundTransaction(projectId, source.id, transaction, {
          amount: Option.getOrUndefined(amount),
          reason: Option.getOrUndefined(flags.reason),
        })
        .pipe(
          Effect.mapError((error) =>
            apiError(error, {
              ...sourceHints(providerHandle(source)),
              transaction_not_found: `${providerLabel(source)} has no recorded charge ${transaction}; check the id, the source's own.`,
            }),
          ),
        );
      yield* printItem(
        mode,
        refund,
        `Refunded charge ${transaction}: refund ${refund.id} ${describeOutcome(refund)}.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Refund a charge at its payment source, which must implement refunds; Voidhash records the refund it answers with. Asks first; --yes skips that.",
  ),
);

const CANCEL_USAGE = "voidhash-cli provider cancel-subscription <source> --subscription <id>";

/** `voidhash-cli provider cancel-subscription <source> --subscription <id> [--now] [--yes]` */
export const providerCancelSubscriptionCommand = Command.make(
  "cancel-subscription",
  {
    source: sourceArgument,
    subscription: Flag.String("subscription").pipe(
      Flag.withDescription("The subscription's id at the source"),
      Flag.optional,
    ),
    now: Flag.Boolean("now").pipe(
      Flag.withDescription("End access now instead of at the end of the paid period"),
      Flag.withDefault(false),
    ),
    project: projectOption,
    yes: yesOption,
    ...outputOptions,
  },
  (flags) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf(flags);
      const api = yield* ApiClient;
      const context = yield* resolveProject(flags.project);
      const projectId = context.project.id;
      const source = yield* requireSource(projectId, flags.source, CANCEL_USAGE);
      const subscription = yield* Option.match(flags.subscription, {
        onNone: () => Effect.fail(missingInput("--subscription", CANCEL_USAGE)),
        onSome: Effect.succeed,
      });
      yield* confirmChange({
        yes: flags.yes,
        message: `Cancel subscription ${subscription} at ${providerLabel(source)} in ${projectKind(context.session).label(context.project)}? ${flags.now ? "The subscriber loses access now." : "It stops renewing; access lasts to the end of the paid period."}`,
      });
      const canceled = yield* api
        .paymentSourcesCancelSubscription(projectId, source.id, subscription, {
          isImmediate: flags.now,
        })
        .pipe(Effect.mapError((error) => apiError(error, sourceHints(providerHandle(source)))));
      yield* printItem(
        mode,
        canceled,
        `Canceled subscription ${subscription} at ${providerLabel(source)}${flags.now ? "; access ended now" : "; access lasts to the end of the paid period"}.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Cancel a subscription at its payment source, which must implement cancellations; Voidhash records the state it answers with. Asks first; --yes skips that.",
  ),
);
