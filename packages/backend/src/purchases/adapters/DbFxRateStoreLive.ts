import {
  FxRateLookup,
  FxRateStore,
  PurchasePortError,
  type FxRateStoreShape,
} from "@voidhash/core-v2";
import { Db, fxRates } from "@voidhash/db";
import { generateId } from "@voidhash/core/utils/generate-id";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

const portError = (message: string) => (cause: unknown) =>
  new PurchasePortError({ cause, message });

const decodeRate = (row: {
  readonly asOfDate: Date;
  readonly currency: string;
  readonly source: string;
  readonly usdRate: number;
}) =>
  Schema.decodeUnknownEffect(FxRateLookup)({
    asOfDate: row.asOfDate,
    currency: row.currency,
    rate: row.usdRate,
    source: row.source,
  });

/** PostgreSQL durable FX cache. */
export const DbFxRateStoreLive = Layer.effect(
  FxRateStore,
  Effect.gen(function* () {
    const db = yield* Db;

    return FxRateStore.of({
      findExact: ({ asOfDate, currency }) =>
        db.query.fxRates.findFirst({ where: { asOfDate: { eq: asOfDate }, currency } }).pipe(
          Effect.flatMap((row) => {
            if (row === undefined) return Effect.succeed(Option.none());
            return decodeRate(row).pipe(Effect.map(Option.some));
          }),
          Effect.mapError(portError("failed to load exact FX rate")),
        ),
      findMostRecent: ({ currency, from, to }) =>
        db.query.fxRates
          .findFirst({
            orderBy: { asOfDate: "desc" },
            where: { asOfDate: { gte: from, lte: to }, currency },
          })
          .pipe(
            Effect.flatMap((row) => {
              if (row === undefined) return Effect.succeed(Option.none());
              return decodeRate(row).pipe(Effect.map(Option.some));
            }),
            Effect.mapError(portError("failed to load carried FX rate")),
          ),
      hasAny: () =>
        db.query.fxRates.findFirst({ columns: { id: true } }).pipe(
          Effect.map((row) => row !== undefined),
          Effect.mapError(portError("failed to inspect FX cache")),
        ),
      persist: (rates) =>
        Effect.fn("persist")(function* () {
          const fetchedAt = yield* DateTime.nowAsDate;
          yield* Effect.forEach(
            rates,
            (rate) =>
              db
                .insert(fxRates)
                .values({
                  asOfDate: rate.asOfDate,
                  currency: rate.currency,
                  fetchedAt,
                  id: generateId("fxRate"),
                  source: rate.source,
                  usdRate: rate.rate,
                })
                .onConflictDoNothing({ target: [fxRates.currency, fxRates.asOfDate] }),
            { concurrency: 8, discard: true },
          );
        })().pipe(Effect.mapError(portError("failed to persist FX rates"))),
    } satisfies FxRateStoreShape);
  }),
);
