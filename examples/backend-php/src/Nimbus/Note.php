<?php

declare(strict_types=1);

namespace Voidhash\Example\Nimbus;

final class Note
{
    public function __construct(
        public readonly string $id,
        public readonly string $title,
        public readonly string $body,
        public readonly string $createdAt,
    ) {
    }

    /** @return array{id: string, title: string, body: string, createdAt: string} */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'body' => $this->body,
            'createdAt' => $this->createdAt,
        ];
    }

    /** @param array<string, mixed> $row */
    public static function fromArray(array $row): self
    {
        return new self(
            id: (string) ($row['id'] ?? ''),
            title: (string) ($row['title'] ?? ''),
            body: (string) ($row['body'] ?? ''),
            createdAt: (string) ($row['createdAt'] ?? ''),
        );
    }
}
