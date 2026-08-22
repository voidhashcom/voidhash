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
            // `CaptureBodyNormalizer` runs first so it can fix up the two
            // required record fields the generated normalizer flattens.
            [new ArrayDenormalizer(), new CaptureBodyNormalizer(), new EventCaptureNormalizer()],
            [new JsonEncoder()],
        );
    }
}
