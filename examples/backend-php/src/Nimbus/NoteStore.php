<?php

declare(strict_types=1);

namespace Voidhash\Example\Nimbus;

/**
 * The notes, keyed by distinct id. This is the product; Voidhash only decides
 * how many of them a person is allowed to keep.
 */
final class NoteStore
{
    public const FREE_LIMIT = 3;

    public function __construct(private readonly StateFile $state)
    {
    }

    /** @return list<Note> */
    public function listFor(string $distinctId): array
    {
        $rows = $this->state->read()[$distinctId] ?? [];

        return is_array($rows) ? array_values(array_map(Note::fromArray(...), $rows)) : [];
    }

    public function countFor(string $distinctId): int
    {
        return count($this->listFor($distinctId));
    }

    /** Appends a note. Quota is enforced by the caller, which knows about entitlements. */
    public function add(string $distinctId, string $title, string $body): Note
    {
        $note = new Note(
            id: 'note_' . bin2hex(random_bytes(8)),
            title: $title,
            body: $body,
            createdAt: gmdate('Y-m-d\TH:i:s\Z'),
        );

        $this->state->mutate(static function (array $state) use ($distinctId, $note): array {
            $existing = $state[$distinctId] ?? [];
            $state[$distinctId] = [...is_array($existing) ? $existing : [], $note->toArray()];

            return $state;
        });

        return $note;
    }

    /**
     * Notes a free account may still create, or null when the account is Pro
     * and the question does not apply.
     */
    public static function remaining(int $count, bool $isPro): ?int
    {
        return $isPro ? null : max(0, self::FREE_LIMIT - $count);
    }
}
