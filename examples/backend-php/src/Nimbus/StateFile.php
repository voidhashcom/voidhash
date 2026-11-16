<?php

declare(strict_types=1);

namespace Voidhash\Example\Nimbus;

/**
 * A JSON document on disk, read and written under an exclusive lock.
 *
 * The other examples in this suite keep their notes, entitlement cache and
 * webhook dedupe set in a process-global map. PHP cannot: the request is the
 * process lifetime, so a static array is empty again on the next call. A file
 * under the system temp directory is the smallest thing that still behaves
 * like the other examples across requests, and it keeps the demo dependency
 * free.
 *
 * Do not ship this. A real deployment wants APCu for a single box (shared
 * across php-fpm workers, evicted for you) or Redis once there is more than
 * one — the three classes built on top of this one, {@see NoteStore},
 * {@see EntitlementCache} and {@see WebhookHandler}, are the only places that
 * would change.
 */
final class StateFile
{
    public function __construct(private readonly string $path)
    {
    }

    /**
     * Opens (creating if needed) a JSON file inside `$directory`.
     *
     * @throws \RuntimeException when the directory cannot be created
     */
    public static function in(string $directory, string $name): self
    {
        if (!is_dir($directory) && !mkdir($directory, 0o700, true) && !is_dir($directory)) {
            throw new \RuntimeException(sprintf('cannot create state directory "%s"', $directory));
        }

        return new self($directory . '/' . $name);
    }

    /** @return array<string, mixed> */
    public function read(): array
    {
        $handle = $this->open();

        try {
            flock($handle, LOCK_SH);

            return $this->decode((string) stream_get_contents($handle));
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    /**
     * Reads, transforms and writes the document while holding an exclusive
     * lock, so two concurrent php-fpm workers cannot lose each other's writes.
     *
     * @param \Closure(array<string, mixed>): array<string, mixed> $mutator
     */
    public function mutate(\Closure $mutator): void
    {
        $handle = $this->open();

        try {
            flock($handle, LOCK_EX);
            $next = $mutator($this->decode((string) stream_get_contents($handle)));

            rewind($handle);
            ftruncate($handle, 0);
            fwrite($handle, json_encode($next, JSON_THROW_ON_ERROR));
            fflush($handle);
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    /** @return resource */
    private function open()
    {
        $handle = @fopen($this->path, 'c+');

        if ($handle === false) {
            throw new \RuntimeException(sprintf('cannot open state file "%s"', $this->path));
        }

        return $handle;
    }

    /** @return array<string, mixed> */
    private function decode(string $contents): array
    {
        if (trim($contents) === '') {
            return [];
        }

        try {
            $decoded = json_decode($contents, true, 64, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return [];
        }

        return is_array($decoded) ? $decoded : [];
    }
}
