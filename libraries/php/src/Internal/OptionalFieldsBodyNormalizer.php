<?php

namespace Voidhash\Internal;

use Symfony\Component\Serializer\Normalizer\NormalizerAwareInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareTrait;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;
use Voidhash\Generated\Core\Model\CancelPaymentSourceSubscriptionBody;
use Voidhash\Generated\Core\Model\RefundPaymentSourceTransactionBody;
use Voidhash\Generated\Core\Model\RotateApiKeyBodyJsonEncoding;
use Voidhash\Generated\Core\Model\UpdatePersonBodyJsonEncoding;

/**
 * Sends a request body whose fields are all optional as `{}` when none is set.
 *
 * The generated normalizer returns a plain PHP array, and an empty one encodes
 * as `[]`, which the API refuses as a body that is not an object. Delegation
 * back to the generated normalizer follows {@see CaptureBodyNormalizer}.
 *
 * @internal
 */
final class OptionalFieldsBodyNormalizer implements NormalizerInterface, NormalizerAwareInterface
{
    use NormalizerAwareTrait;

    private const ALREADY_CALLED = 'voidhash_optional_fields_body_normalized';

    /** The bodies the SDK may send without any field set. */
    private const BODIES = [
        CancelPaymentSourceSubscriptionBody::class,
        RefundPaymentSourceTransactionBody::class,
        RotateApiKeyBodyJsonEncoding::class,
        UpdatePersonBodyJsonEncoding::class,
    ];

    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data)
            && in_array($data::class, self::BODIES, true)
            && ($context[self::ALREADY_CALLED] ?? false) !== true;
    }

    /**
     * @return array<string, mixed>|\ArrayObject<string, mixed>
     */
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|\ArrayObject
    {
        $context[self::ALREADY_CALLED] = true;
        /** @var array<string, mixed> $normalized */
        $normalized = $this->normalizer->normalize($data, $format, $context);

        return $normalized === [] ? new \ArrayObject() : $normalized;
    }

    public function getSupportedTypes(?string $format = null): array
    {
        return array_fill_keys(self::BODIES, false);
    }
}
