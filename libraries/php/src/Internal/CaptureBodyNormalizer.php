<?php

namespace Voidhash\Internal;

use Symfony\Component\Serializer\Normalizer\NormalizerAwareInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareTrait;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;
use Voidhash\Generated\EventCapture\Model\IV1BatchPostBody;
use Voidhash\Generated\EventCapture\Model\IV1CapturePostBody;

/**
 * Keeps an event's `context` and `properties` JSON objects when they are empty.
 *
 * The ingest contract types both as records, but the generated normalizer
 * flattens them into plain PHP arrays — and an empty PHP array encodes as `[]`,
 * which ingest rejects with a `400`. Re-wrapping them in `\ArrayObject` makes
 * `json_encode` emit `{}` instead. Everything else is left to the generated
 * normalizer so this survives regeneration.
 *
 * Delegation back to the generated normalizer is guarded with a context flag,
 * which is the Symfony-idiomatic way to decorate a normalizer registered in the
 * same serializer. Because that flag also stops the decoration from reaching
 * the events nested in a batch envelope, those are repaired here as well.
 *
 * @internal
 */
final class CaptureBodyNormalizer implements NormalizerInterface, NormalizerAwareInterface
{
    use NormalizerAwareTrait;

    private const ALREADY_CALLED = 'voidhash_capture_body_normalized';

    private const OBJECT_FIELDS = ['context', 'properties'];

    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return ($data instanceof IV1CapturePostBody || $data instanceof IV1BatchPostBody)
            && ($context[self::ALREADY_CALLED] ?? false) !== true;
    }

    /**
     * @return array<string, mixed>
     */
    public function normalize(mixed $data, ?string $format = null, array $context = []): array
    {
        $context[self::ALREADY_CALLED] = true;
        /** @var array<string, mixed> $normalized */
        $normalized = $this->normalizer->normalize($data, $format, $context);

        if ($data instanceof IV1BatchPostBody) {
            $normalized['events'] = array_map(self::keepJsonObjects(...), $normalized['events']);

            return $normalized;
        }

        return self::keepJsonObjects($normalized);
    }

    public function getSupportedTypes(?string $format = null): array
    {
        return [IV1CapturePostBody::class => false, IV1BatchPostBody::class => false];
    }

    /**
     * @param array<string, mixed> $event
     *
     * @return array<string, mixed>
     */
    private static function keepJsonObjects(array $event): array
    {
        foreach (self::OBJECT_FIELDS as $field) {
            if (($event[$field] ?? null) === []) {
                $event[$field] = new \ArrayObject();
            }
        }

        return $event;
    }
}
