import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Encoding from "effect/Encoding";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

import { ActionForbiddenError } from "../domain/auth/Auth.ts";

/** Page size used when the caller does not ask for one. */
export const DEFAULT_PAGE_SIZE = 50;

/** Largest page a caller may request. */
export const MAX_PAGE_SIZE = 100;

/** The cursor state returned alongside a page of results. */
export interface PageInfo {
  readonly endCursor: string | typeof Schema.Null.Type;
  readonly hasNextPage: boolean;
}

/** A page of results plus its cursor state. */
export interface Page<A> {
  readonly data: ReadonlyArray<A>;
  readonly pageInfo: PageInfo;
}

/** Returns a copy ordered by the unique identity used as its pagination cursor. */
export const sortById = <A>(items: ReadonlyArray<A>, getId: (item: A) => string): Array<A> =>
  Arr.sortWith(items, getId, Str.Order);

/**
 * Encodes an item's identity into an opaque cursor. Base64url keeps the value
 * URL-safe without percent-encoding, and the opacity is deliberate: callers
 * must echo cursors back rather than construct them, which leaves us free to
 * change the sort key later without a breaking change.
 */
export const encodeCursor = (id: string): string => Encoding.encodeBase64Url(id);

/**
 * Decodes a cursor produced by {@link encodeCursor}. Fails with
 * `ActionForbiddenError` on a malformed value rather than silently restarting
 * from the first page, so a truncated cursor surfaces as an error instead of
 * an infinite pagination loop.
 */
export const decodeCursor = (cursor: string): Effect.Effect<string, ActionForbiddenError> =>
  Result.match(Encoding.decodeBase64UrlString(cursor), {
    onFailure: () =>
      Effect.fail(
        new ActionForbiddenError({
          message: "Invalid pagination cursor.",
        }),
      ),
    onSuccess: (decoded: string) => Effect.succeed(decoded),
  });

/**
 * Applies cursor pagination to an in-memory collection.
 *
 * This is *not* the universal read mechanism. It materialises the whole
 * collection before slicing it, so it is reserved for the bounded,
 * configuration-shaped collections a single project can hold: API keys,
 * organizations and their projects, experiments, feature flags (plus overrides
 * and targets), paywalls and their releases, paywall deploys, paywall
 * locations and showings, perks, products and product links, payment-provider
 * configurations and products, push-notification configurations, and webhook
 * endpoints — plus the `GET /persons?distinctId=` filter, which resolves to at
 * most one row. Those are hand-curated lists with a ceiling in the hundreds,
 * written by humans rather than by SDK traffic, so one full read per page is
 * cheap and the "cursor row was deleted" failure mode is rare and legible.
 *
 * The high-cardinality collections do not use this: `GET /events`
 * (`AnalyticsEventStore.listPage`), the unfiltered `GET /persons`
 * (`PersonService.getPersonsPage`), webhook deliveries
 * (`WebhookManagerService.getDeliveriesPage`), and push-notification sends /
 * send deliveries (`PushNotificationSendService.listSendsPage` /
 * `getSendDeliveriesPage`) all page with a keyset read in SQL, and produce the
 * same `{ data, pageInfo }` envelope and the same opaque cursors.
 *
 * @param items - the full collection, already in a stable sort order
 * @param getId - extracts the cursor key; must be unique and match the sort order
 * @param params - the caller's `cursor` / `limit`
 */
export const paginate = <A>(
  items: ReadonlyArray<A>,
  getId: (item: A) => string,
  params: { readonly cursor?: string; readonly limit?: number },
): Effect.Effect<Page<A>, ActionForbiddenError> =>
  Effect.gen(function* () {
    const limit = Math.min(params.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    let start = 0;
    if (params.cursor !== undefined) {
      const afterId = yield* decodeCursor(params.cursor);
      const index = items.findIndex((item) => getId(item) === afterId);
      // A cursor pointing at an item that has since been deleted would
      // otherwise silently replay page one; treat it as a client error.
      if (index === -1) {
        return yield* Effect.fail(
          new ActionForbiddenError({
            message: "Pagination cursor no longer refers to a known item.",
          }),
        );
      }
      start = index + 1;
    }

    const data = items.slice(start, start + limit);
    const hasNextPage = start + limit < items.length;
    const last = data[data.length - 1];
    const nextCursor = hasNextPage && last !== undefined ? encodeCursor(getId(last)) : null;

    return {
      data,
      pageInfo: {
        endCursor: nextCursor,
        hasNextPage,
      },
    };
  });
