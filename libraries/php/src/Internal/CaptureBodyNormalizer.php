<?php

namespace Voidhash\Internal;

use Symfony\Component\Serializer\Normalizer\NormalizerAwareInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareTrait;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;
use Voidhash\Generated\EventCapture\Model\IV1CapturePostBody;
use Voidhash\Generated\EventCapture\Normalizer\IV1CapturePostBodyNormalizer;

/**
 * Keeps a capture body's `context` and `properties` JSON objects when they are
 * empty.
 *
 * The ingest contract types both as records, but the generated normalizer
 * flattens them into plain PHP arrays — and an empty PHP array encodes as `[]`,
 * which ingest rejects with a `400`. Re-wrapping them in `\ArrayObject` makes
 * `json_encode` emit `{}` instead. Everything else is left to the generated
 * normalizer so this survives regeneration.
 *
 * @internal
 */
final class CaptureBodyNormalizer implements NormalizerInterface, NormalizerAwareInterface
{
    use NormalizerAwareTrait;

    private const OBJECT_FIELDS = ['context', 'properties'];

    public function __construct(private readonly IV1CapturePostBodyNormalizer $inner)
    {
    }

    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return $data instanceof IV1CapturePostBody;
    }

    public function normalize(mixed $data, ?string $format = null, array $context = []): array
    {
        $this->inner->setNormalizer($this->normalizer);
        /** @var array<string, mixed> $normalized */
        $normalized = $this->inner->normalize($data, $format, $context);

        foreach (self::OBJECT_FIELDS as $field) {
            if (($normalized[$field] ?? null) === []) {
                $normalized[$field] = new \ArrayObject();
            }
        }

        return $normalized;
    }

    public function getSupportedTypes(?string $format = null): array
    {
        return [IV1CapturePostBody::class => false];
    }
}
