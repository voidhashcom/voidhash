import type { Analytics } from "../analytics";
import type { EntitlementsCache } from "../entitlements-cache";
import { readJsonObject, requireDistinctId, requireString, sendJson } from "../http";
import { ANALYTICS_EVENTS, FREE_NOTE_LIMIT } from "../nimbus";
import { canCreateNote, quotaFor, type NoteStore } from "../notes";
import type { RouteHandler } from "../server";

export type NoteRouteOptions = {
  readonly entitlements: EntitlementsCache;
  readonly notes: NoteStore;
  readonly analytics: Analytics;
};

/** `GET /v1/notes?distinctId=…` — the caller's notes and remaining free quota. */
export const createListNotesRoute = (options: NoteRouteOptions): RouteHandler => {
  const { entitlements, notes } = options;

  return async (_request, response, url) => {
    const distinctId = requireDistinctId(url);
    const access = await entitlements.resolve(distinctId);
    const stored = notes.list(distinctId);

    sendJson(response, 200, {
      distinctId,
      notes: stored,
      plan: access.hasPro ? "pro" : "free",
      quota: quotaFor(stored.length, access.hasPro),
    });
  };
};

/**
 * `POST /v1/notes` — creates a note.
 *
 * The quota is enforced against the server's own entitlement check, never
 * against a flag the client sent. A free account holding three notes gets
 * `403 note_limit_reached`, which is the app's cue to present the paywall.
 */
export const createCreateNoteRoute = (options: NoteRouteOptions): RouteHandler => {
  const { analytics, entitlements, notes } = options;

  return async (request, response) => {
    const body = await readJsonObject(request);
    const distinctId = requireString(body.distinctId, "distinct_id_required");
    const text = requireString(body.body, "note_body_required");

    const access = await entitlements.resolve(distinctId);
    const used = notes.count(distinctId);

    if (!canCreateNote(used, access.hasPro)) {
      sendJson(response, 403, {
        error: "note_limit_reached",
        limit: FREE_NOTE_LIMIT,
        quota: quotaFor(used, access.hasPro),
      });

      return;
    }

    const note = notes.create(distinctId, text);

    analytics.capture({ distinctId, event: ANALYTICS_EVENTS.noteCreated });
    // `plan` and `notes_created` describe the person, not this one event, so
    // they are written as person traits instead of repeated on every capture.
    analytics.setAttributes({
      distinctId,
      traits: {
        notes_created: notes.count(distinctId),
        plan: access.hasPro ? "pro" : "free",
      },
    });

    sendJson(response, 201, {
      note,
      quota: quotaFor(notes.count(distinctId), access.hasPro),
    });
  };
};

/**
 * `GET /v1/notes/export?distinctId=…` — Pro only.
 *
 * `402 premium_required` is the canonical "you have not paid for this" answer;
 * a 403 would suggest the user could never have access.
 */
export const createExportNotesRoute = (options: NoteRouteOptions): RouteHandler => {
  const { analytics, entitlements, notes } = options;

  return async (_request, response, url) => {
    const distinctId = requireDistinctId(url);
    const access = await entitlements.resolve(distinctId);

    if (!access.hasPro) {
      sendJson(response, 402, { error: "premium_required" });

      return;
    }

    const stored = notes.list(distinctId);

    analytics.capture({ distinctId, event: ANALYTICS_EVENTS.exportRequested });
    analytics.setAttributes({
      distinctId,
      traits: { notes_created: stored.length, plan: "pro" },
    });

    sendJson(response, 200, {
      distinctId,
      exportedAt: new Date().toISOString(),
      notes: stored,
    });
  };
};
