<?php

namespace Voidhash\Internal;

use Symfony\Component\Serializer\Encoder\JsonEncoder;
use Symfony\Component\Serializer\Normalizer\ArrayDenormalizer;
use Symfony\Component\Serializer\Serializer;
use Voidhash\Generated\Core\Normalizer\JaneObjectNormalizer as CoreNormalizer;
use Voidhash\Generated\EventCapture\Normalizer\JaneObjectNormalizer as EventCaptureNormalizer;

/**
 * Builds the Symfony serializer instances the generated clients require.
 *
 * @internal
 */
final class SerializerFactory
{
    public static function core(): Serializer
    {
        return new Serializer(
            [new ArrayDenormalizer(), new CoreNormalizer()],
            [new JsonEncoder()],
        );
    }

    public static function eventCapture(): Serializer
    {
        return new Serializer(
            [new ArrayDenormalizer(), new EventCaptureNormalizer()],
            [new JsonEncoder()],
        );
    }
}
