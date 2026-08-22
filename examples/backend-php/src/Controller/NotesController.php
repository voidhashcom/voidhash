<?php

declare(strict_types=1);

namespace Voidhash\Example\Controller;

use Voidhash\Example\Exception\HttpException;
use Voidhash\Example\Nimbus\Analytics;
use Voidhash\Example\Nimbus\EntitlementCache;
use Voidhash\Example\Nimbus\EntitlementResolver;
use Voidhash\Example\Nimbus\Note;
use Voidhash\Example\Nimbus\NoteStore;
use Voidhash\Example\Request;
use Voidhash\Example\Response;

final class NotesController
{
    /** The paywall location the apps present when one of these routes says no. */
    private const PAYWALL_LOCATION = 'onboarding';

    public function __construct(
        private readonly NoteStore $notes,
        private readonly EntitlementCache $entitlements,
        private readonly Analytics $analytics,
    ) {
    }

    /** `GET /v1/notes?distinctId=…` — the caller's notes and their remaining free quota. */
    public function list(Request $request): Response
    {
        $distinctId = $request->requireDistinctId();
        $entitlements = $this->entitlements->resolve($distinctId);
        $isPro = $entitlements->hasPerk(EntitlementResolver::PRO_PERK_SLUG);
        $notes = $this->notes->listFor($distinctId);

        return Response::json(200, [
            'distinctId' => $distinctId,
            'plan' => $isPro ? 'pro' : 'free',
            'notes' => array_map(static fn (Note $note): array => $note->toArray(), $notes),
            'limit' => $isPro ? null : NoteStore::FREE_LIMIT,
            'remaining' => NoteStore::remaining(count($notes), $isPro),
            'freshness' => $entitlements->freshness->value,
        ]);
    }

    /**
     * `POST /v1/notes` — creates a note.
     *
     * The quota is enforced server side. The apps hide the button once the
     * limit is reached, but the button is not the security boundary: this is.
     */
    public function create(Request $request): Response
    {
        $body = $request->json();
        $distinctId = Request::requireString($body, 'distinctId');
        $title = Request::requireString($body, 'title');
        $text = is_string($body['body'] ?? null) ? $body['body'] : '';

        $entitlements = $this->entitlements->resolve($distinctId);
        $isPro = $entitlements->hasPerk(EntitlementResolver::PRO_PERK_SLUG);
        $count = $this->notes->countFor($distinctId);

        if (!$isPro && $count >= NoteStore::FREE_LIMIT) {
            $this->analytics->capture(Analytics::PAYWALL_VIEWED, $distinctId, [
                'location' => self::PAYWALL_LOCATION,
                'reason' => 'note_limit_reached',
                'notes_created' => $count,
            ]);

            throw HttpException::forbidden(
                'note_limit_reached',
                sprintf('free accounts keep %d notes; upgrade to Pro for unlimited notes', NoteStore::FREE_LIMIT),
                self::paywall(),
            );
        }

        $note = $this->notes->add($distinctId, $title, $text);

        $this->analytics->capture(Analytics::NOTE_CREATED, $distinctId);
        // `plan` and `notes_created` describe the person, not this one event,
        // so they are written as person traits instead of repeated on every
        // capture.
        $this->analytics->setAttributes($distinctId, [
            'plan' => $isPro ? 'pro' : 'free',
            'notes_created' => $count + 1,
        ]);

        return Response::json(201, [
            'note' => $note->toArray(),
            'plan' => $isPro ? 'pro' : 'free',
            'remaining' => NoteStore::remaining($count + 1, $isPro),
        ]);
    }

    /** `GET /v1/notes/export?distinctId=…` — Pro only. */
    public function export(Request $request): Response
    {
        $distinctId = $request->requireDistinctId();
        $entitlements = $this->entitlements->resolve($distinctId);

        if (!$entitlements->hasPerk(EntitlementResolver::PRO_PERK_SLUG)) {
            $this->analytics->capture(Analytics::PAYWALL_VIEWED, $distinctId, [
                'location' => self::PAYWALL_LOCATION,
                'reason' => 'export_requires_pro',
            ]);

            throw HttpException::paymentRequired(
                'premium_required',
                'exporting notes requires the Pro perk',
                self::paywall(),
            );
        }

        $notes = $this->notes->listFor($distinctId);

        $this->analytics->capture(Analytics::EXPORT_REQUESTED, $distinctId);
        $this->analytics->setAttributes($distinctId, [
            'plan' => 'pro',
            'notes_created' => count($notes),
        ]);

        return Response::json(200, [
            'format' => 'markdown',
            'noteCount' => count($notes),
            'content' => self::toMarkdown($notes),
        ]);
    }

    /**
     * Where the client should send the person next. The apps in this suite
     * present the `onboarding` paywall for this location; a web client would
     * open its pricing page.
     *
     * @return array{paywall: array{location: string, perk: string}}
     */
    private static function paywall(): array
    {
        return ['paywall' => ['location' => self::PAYWALL_LOCATION, 'perk' => EntitlementResolver::PRO_PERK_SLUG]];
    }

    /** @param list<Note> $notes */
    private static function toMarkdown(array $notes): string
    {
        return implode("\n\n", array_map(
            static fn (Note $note): string => sprintf("# %s\n\n%s", $note->title, $note->body),
            $notes,
        ));
    }
}
