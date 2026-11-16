<?php

namespace Voidhash\Generated\EventCapture\Normalizer;

use Jane\Component\JsonSchemaRuntime\Reference;
use Voidhash\Generated\EventCapture\Runtime\Normalizer\CheckArray;
use Voidhash\Generated\EventCapture\Runtime\Normalizer\ValidatorTrait;
use Symfony\Component\Serializer\Normalizer\DenormalizerAwareInterface;
use Symfony\Component\Serializer\Normalizer\DenormalizerAwareTrait;
use Symfony\Component\Serializer\Normalizer\DenormalizerInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareTrait;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;
class CaptureRateLimitedErrorNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\EventCapture\Model\CaptureRateLimitedError::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\EventCapture\Model\CaptureRateLimitedError::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\EventCapture\Model\CaptureRateLimitedError();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('_tag', $data)) {
            $object->setTag($data['_tag']);
        }
        if (\array_key_exists('error', $data)) {
            $object->setError($data['error']);
        }
        if (\array_key_exists('code', $data)) {
            $object->setCode($data['code']);
        }
        if (\array_key_exists('retry_after_ms', $data) && $data['retry_after_ms'] !== null) {
            $object->setRetryAfterMs($data['retry_after_ms']);
        }
        elseif (\array_key_exists('retry_after_ms', $data) && $data['retry_after_ms'] === null) {
            $object->setRetryAfterMs(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['_tag'] = $data->getTag();
        $dataArray['error'] = $data->getError();
        $dataArray['code'] = $data->getCode();
        if ($data->isInitialized('retryAfterMs')) {
            $dataArray['retry_after_ms'] = $data->getRetryAfterMs();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\EventCapture\Model\CaptureRateLimitedError::class => false];
    }
}