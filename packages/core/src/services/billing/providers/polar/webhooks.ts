import {
  billingWebhookEvents,
  eq,
  type InsertBillingWebhookEvent
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import { Effect } from 'effect';
import crypto from 'node:crypto';
import {
  BillingProviderError,
  BillingServiceError
} from '../../../../billing/errors';
import type {
  BillingTierNameValue,
  SubscriptionChangeEvent
} from '../../../../billing/types';
import { BillingService } from '../../billing-service';
import { PolarConfigService } from './config';

/**
 * Polar webhook event types we handle
 */
type PolarWebhookEventType =
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.active'
  | 'subscription.canceled'
  | 'subscription.revoked'
  | 'order.created'
  | 'order.paid'
  | 'customer.created'
  | 'customer.updated';

interface PolarWebhookPayload {
  type: PolarWebhookEventType;
  data: {
    id: string;
    customer_id?: string;
    customerId?: string;
    status?: string;
    current_period_start?: string;
    currentPeriodStart?: string;
    current_period_end?: string;
    currentPeriodEnd?: string;
    product_id?: string;
    productId?: string;
    [key: string]: unknown;
  };
}

const _checkWebhookProcessed = (db: Db) =>
  db.makeQuery(
    (execute, input: { providerId: string; externalEventId: string }) =>
      execute(async (db) => {
        const existing = await db.query.billingWebhookEvents.findFirst({
          where: eq(billingWebhookEvents.externalEventId, input.externalEventId)
        });
        return existing !== undefined;
      })
  );

const _insertWebhookEvent = (db: Db) =>
  db.makeQuery((execute, event: InsertBillingWebhookEvent) =>
    execute(async (db) => {
      await db.insert(billingWebhookEvents).values(event);
    })
  );

const _markWebhookProcessed = (db: Db) =>
  db.makeQuery((execute, id: string) =>
    execute(async (db) => {
      await db
        .update(billingWebhookEvents)
        .set({ processedAt: new Date() })
        .where(eq(billingWebhookEvents.id, id));
    })
  );

const _markWebhookError = (db: Db) =>
  db.makeQuery((execute, input: { id: string; error: string }) =>
    execute(async (db) => {
      await db
        .update(billingWebhookEvents)
        .set({ error: input.error })
        .where(eq(billingWebhookEvents.id, input.id));
    })
  );

/**
 * Verify Polar webhook signature
 * Polar uses Standard Webhooks format
 */
function verifyPolarWebhookSignature(
  payload: string,
  signature: string,
  webhookId: string,
  timestamp: string,
  secret: string
): boolean {
  const signedContent = `${webhookId}.${timestamp}.${payload}`;
  const secretBytes = Buffer.from(secret.split('_')[1] ?? secret, 'base64');
  const expectedSignature = crypto
    .createHmac('sha256', secretBytes)
    .update(signedContent)
    .digest('base64');

  // Signature header can have multiple signatures separated by space
  const signatures = signature.split(' ');
  for (const sig of signatures) {
    const sigParts = sig.split(',');
    for (const part of sigParts) {
      if (part.startsWith('v1,')) {
        const sigValue = part.substring(3);
        if (sigValue === expectedSignature) {
          return true;
        }
      }
    }
  }

  // Also try direct comparison
  return signatures.some((s) => s.includes(expectedSignature));
}

/**
 * Map Polar product ID to tier
 */
function mapProductIdToTier(
  productId: string | undefined,
  config: { tierProductIds: { pro: string; enterprise: string } }
): BillingTierNameValue | undefined {
  if (!productId) return undefined;
  if (productId === config.tierProductIds.enterprise) return 'enterprise';
  if (productId === config.tierProductIds.pro) return 'pro';
  return 'free';
}

/**
 * Map Polar subscription status to our status
 */
function mapPolarStatus(
  status: string | undefined
): 'active' | 'canceled' | 'past_due' | 'trialing' {
  switch (status) {
    case 'active':
      return 'active';
    case 'canceled':
    case 'revoked':
      return 'canceled';
    case 'past_due':
    case 'incomplete':
    case 'unpaid':
      return 'past_due';
    case 'trialing':
      return 'trialing';
    default:
      return 'active';
  }
}

export const handlePolarWebhook = Effect.gen(function* () {
  const db = yield* Db;
  const config = yield* PolarConfigService;
  const billingService = yield* BillingService;

  return Effect.fn('handlePolarWebhook')(
    function* (input: {
      payload: string;
      signature: string;
      webhookId: string;
      timestamp: string;
    }) {
      // Verify signature
      const isValid = verifyPolarWebhookSignature(
        input.payload,
        input.signature,
        input.webhookId,
        input.timestamp,
        config.webhookSecret
      );

      if (!isValid) {
        return yield* Effect.fail(
          new BillingProviderError({
            message: 'Invalid webhook signature',
            provider: 'polar'
          })
        );
      }

      // Parse payload
      const event = JSON.parse(input.payload) as PolarWebhookPayload;
      const eventId = `${event.type}_${event.data.id}_${input.timestamp}`;

      // Check idempotency
      const alreadyProcessed = yield* _checkWebhookProcessed(db)({
        providerId: 'polar',
        externalEventId: eventId
      });

      if (alreadyProcessed) {
        yield* Effect.log(
          `Webhook event ${eventId} already processed, skipping`
        );
        return;
      }

      // Record webhook event
      const webhookEventId = generateId('billingWebhookEvent');
      yield* _insertWebhookEvent(db)({
        id: webhookEventId,
        providerId: 'polar',
        externalEventId: eventId,
        eventType: event.type,
        payload: event as unknown as object
      });

      // Process based on event type
      try {
        switch (event.type) {
          case 'subscription.created':
          case 'subscription.updated':
          case 'subscription.active': {
            const customerId = event.data.customer_id ?? event.data.customerId;
            if (!customerId) break;

            const subscriptionEvent: SubscriptionChangeEvent = {
              externalSubscriptionId: event.data.id,
              externalCustomerId: customerId,
              status: mapPolarStatus(event.data.status),
              currentPeriodStart: event.data.current_period_start
                ? new Date(event.data.current_period_start)
                : event.data.currentPeriodStart
                  ? new Date(event.data.currentPeriodStart)
                  : undefined,
              currentPeriodEnd: event.data.current_period_end
                ? new Date(event.data.current_period_end)
                : event.data.currentPeriodEnd
                  ? new Date(event.data.currentPeriodEnd)
                  : undefined,
              tier: mapProductIdToTier(
                event.data.product_id ?? event.data.productId,
                config
              )
            };

            yield* billingService.handleSubscriptionChange(subscriptionEvent);
            break;
          }

          case 'subscription.canceled':
          case 'subscription.revoked': {
            const customerId = event.data.customer_id ?? event.data.customerId;
            if (!customerId) break;

            const cancelEvent: SubscriptionChangeEvent = {
              externalSubscriptionId: event.data.id,
              externalCustomerId: customerId,
              status: 'canceled'
            };

            yield* billingService.handleSubscriptionChange(cancelEvent);
            break;
          }

          case 'order.paid':
            // Handle one-time payments if needed
            yield* Effect.log(`Order paid: ${event.data.id}`);
            break;

          case 'customer.created':
          case 'customer.updated':
            // Customer events can be used for sync if needed
            yield* Effect.log(`Customer event: ${event.type} ${event.data.id}`);
            break;

          default:
            yield* Effect.log(`Unhandled webhook event type: ${event.type}`);
        }

        // Mark as processed
        yield* _markWebhookProcessed(db)(webhookEventId);
      } catch (error) {
        // Mark with error
        yield* _markWebhookError(db)({
          id: webhookEventId,
          error: String(error)
        });
        throw error;
      }
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new BillingServiceError({
              message: 'Failed to process webhook',
              cause: String(error.cause)
            })
        })
      )
  );
});
