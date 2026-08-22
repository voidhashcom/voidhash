<?php

declare(strict_types=1);

namespace Voidhash\Example\Nimbus;

/**
 * What Voidhash knows about one distinct id: the person record, their
 * entitlement grants, and how much the answer should be trusted.
 */
final class Entitlements
{
    /**
     * @param array{personId: string, distinctId: string, email: string|null, name: string|null}|null $person
     *        null when Voidhash has never seen this distinct id
     * @param list<array{perkId: string, perkSlug: string|null, status: string, source: string, expiresAt: string|null}> $grants
     */
    public function __construct(
        public readonly ?array $person,
        public readonly array $grants,
        public readonly Freshness $freshness,
    ) {
    }

    /**
     * A distinct id Voidhash has never seen. Not an error: it is what every
     * person looks like before they sign in for the first time.
     */
    public static function unknownPerson(Freshness $freshness): self
    {
        return new self(null, [], $freshness);
    }

    public function hasPerk(string $slug): bool
    {
        return in_array($slug, $this->activePerkSlugs(), true);
    }

    /** @return list<string> */
    public function activePerkSlugs(): array
    {
        $slugs = [];

        foreach ($this->grants as $grant) {
            if ($grant['status'] === 'active' && $grant['perkSlug'] !== null) {
                $slugs[] = $grant['perkSlug'];
            }
        }

        return array_values(array_unique($slugs));
    }

    public function withFreshness(Freshness $freshness): self
    {
        return new self($this->person, $this->grants, $freshness);
    }

    /** @return array{person: array<string, mixed>|null, grants: list<array<string, mixed>>} */
    public function toArray(): array
    {
        return ['person' => $this->person, 'grants' => $this->grants];
    }

    /**
     * Rebuilds a snapshot from its cached form. Unrecognised shapes decay to
     * "no grants" rather than throwing: a cache is never worth a 500.
     *
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data, Freshness $freshness): self
    {
        /** @var array{personId: string, distinctId: string, email: string|null, name: string|null}|null $person */
        $person = is_array($data['person'] ?? null) ? $data['person'] : null;
        /** @var list<array{perkId: string, perkSlug: string|null, status: string, source: string, expiresAt: string|null}> $grants */
        $grants = is_array($data['grants'] ?? null) ? array_values($data['grants']) : [];

        return new self($person, $grants, $freshness);
    }
}
