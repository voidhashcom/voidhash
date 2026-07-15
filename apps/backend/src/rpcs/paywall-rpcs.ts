import {
  MimicHost,
  PaywallReleaseService,
  PaywallService,
  PaywallThumbnailService,
} from "@voidhash/core/services";
import {
  PaywallRpcsDef,
  RpcActionForbiddenError,
  RpcPaywallNotFoundError,
  RpcPaywallReleaseError,
  RpcPaywallServiceError,
  RpcPaywallSlugAlreadyExistsError,
  RpcReleaseNotFoundError,
} from "@voidhash/rpc";
import { Effect } from "effect";

export const PaywallRpcsLive = PaywallRpcsDef.toLayer(
  Effect.gen(function* () {
    const paywallService = yield* PaywallService;
    const releaseService = yield* PaywallReleaseService;
    const thumbnailService = yield* PaywallThumbnailService;
    const mimicHost = yield* MimicHost;

    return {
      BackfillPaywallThumbnails: ({ projectId }) =>
        Effect.gen(function* () {
          const projectPaywalls = yield* paywallService.getPaywalls(projectId, true);
          const missing = projectPaywalls.filter((paywall) => paywall.thumbnailUrl === null);
          const results = yield* Effect.forEach(
            missing,
            (paywall) =>
              thumbnailService.renderCurrent(paywall.id).pipe(
                Effect.as(true),
                Effect.catchTag("PaywallThumbnailServiceError", (error) =>
                  Effect.logError("Paywall thumbnail backfill failed", {
                    paywallId: paywall.id,
                    message: error.message,
                  }).pipe(Effect.as(false)),
                ),
              ),
            { concurrency: 1 },
          );
          return {
            attempted: missing.length,
            rendered: results.filter(Boolean).length,
          };
        }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallServiceError: (error) =>
              Effect.fail(new RpcPaywallServiceError({ cause: error.cause })),
          }),
        ),
      CreatePaywall: (input) =>
        paywallService.createPaywall(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallServiceError: (error) =>
              Effect.fail(new RpcPaywallServiceError({ cause: error.cause })),
            PaywallSlugAlreadyExistsError: (error) =>
              Effect.fail(new RpcPaywallSlugAlreadyExistsError({ slug: error.slug })),
            AuditLogPortError: (error) =>
              Effect.fail(new RpcPaywallServiceError({ cause: error.cause })),
          }),
        ),
      CreatePaywallRelease: ({ paywallId }) =>
        releaseService.createRelease(paywallId).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallNotFoundError: (error) =>
              Effect.fail(new RpcPaywallNotFoundError({ message: error.message })),
            PaywallReleaseError: (error) =>
              Effect.fail(
                new RpcPaywallReleaseError({ cause: error.cause, message: error.message }),
              ),
          }),
        ),
      ArchivePaywall: (input) =>
        paywallService.archivePaywall(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallNotFoundError: (error) =>
              Effect.fail(new RpcPaywallNotFoundError({ message: error.message })),
            PaywallServiceError: (error) =>
              Effect.fail(new RpcPaywallServiceError({ cause: error.cause })),
            AuditLogPortError: (error) =>
              Effect.fail(new RpcPaywallServiceError({ cause: error.cause })),
          }),
        ),
      DeletePaywall: (input) =>
        paywallService.deletePaywall(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallNotFoundError: (error) =>
              Effect.fail(new RpcPaywallNotFoundError({ message: error.message })),
            PaywallServiceError: (error) =>
              Effect.fail(new RpcPaywallServiceError({ cause: error.cause })),
            AuditLogPortError: (error) =>
              Effect.fail(new RpcPaywallServiceError({ cause: error.cause })),
          }),
        ),
      GetPaywallDraftRelease: ({ paywallId }) =>
        releaseService.getDraftRelease(paywallId).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallNotFoundError: (error) =>
              Effect.fail(new RpcPaywallNotFoundError({ message: error.message })),
            PaywallReleaseError: (error) =>
              Effect.fail(
                new RpcPaywallReleaseError({ cause: error.cause, message: error.message }),
              ),
          }),
        ),
      ListPaywalls: ({ includeArchived, projectId }) =>
        paywallService.getPaywalls(projectId, includeArchived).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallServiceError: (error) =>
              Effect.fail(new RpcPaywallServiceError({ cause: error.cause })),
          }),
        ),
      PublishPaywallRelease: ({ releaseId }) =>
        releaseService.publishRelease(releaseId).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallNotFoundError: (error) =>
              Effect.fail(new RpcPaywallReleaseError({ message: error.message })),
            PaywallReleaseError: (error) =>
              Effect.fail(
                new RpcPaywallReleaseError({ cause: error.cause, message: error.message }),
              ),
            ReleaseNotFoundError: (error) =>
              Effect.fail(new RpcReleaseNotFoundError({ releaseId: error.releaseId })),
          }),
        ),
      RenamePaywall: (input) =>
        paywallService.renamePaywall(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallNotFoundError: (error) =>
              Effect.fail(new RpcPaywallNotFoundError({ message: error.message })),
            PaywallServiceError: (error) =>
              Effect.fail(new RpcPaywallServiceError({ cause: error.cause })),
            AuditLogPortError: (error) =>
              Effect.fail(new RpcPaywallServiceError({ cause: error.cause })),
          }),
        ),
      RestorePaywall: (input) =>
        paywallService.restorePaywall(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallNotFoundError: (error) =>
              Effect.fail(new RpcPaywallNotFoundError({ message: error.message })),
            PaywallServiceError: (error) =>
              Effect.fail(new RpcPaywallServiceError({ cause: error.cause })),
            AuditLogPortError: (error) =>
              Effect.fail(new RpcPaywallServiceError({ cause: error.cause })),
          }),
        ),
      RequestPaywallEditToken: ({ paywallId }) =>
        paywallService.getPaywallById(paywallId).pipe(
          Effect.flatMap(() => mimicHost.ensurePaywallDocument(paywallId)),
          Effect.flatMap(() => mimicHost.createPaywallEditToken({ paywallId })),
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            // MimicHostError details carry internals (binding names, host
            // URLs, SDK errors) — log them server-side, return a generic
            // cause to clients.
            MimicHostError: (error) =>
              Effect.logError(`Paywall edit token mimic host error: ${error.message}`, error).pipe(
                Effect.flatMap(() =>
                  Effect.fail(
                    new RpcPaywallServiceError({ cause: "paywall editing backend unavailable" }),
                  ),
                ),
              ),
            PaywallNotFoundError: (error) =>
              Effect.fail(new RpcPaywallNotFoundError({ message: error.message })),
            PaywallServiceError: (error) =>
              Effect.fail(new RpcPaywallServiceError({ cause: error.cause })),
          }),
        ),
    };
  }),
);
