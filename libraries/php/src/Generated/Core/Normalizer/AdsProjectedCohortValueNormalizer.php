<?php

namespace Voidhash\Generated\Core\Normalizer;

use Jane\Component\JsonSchemaRuntime\Reference;
use Voidhash\Generated\Core\Runtime\Normalizer\CheckArray;
use Voidhash\Generated\Core\Runtime\Normalizer\ValidatorTrait;
use Symfony\Component\Serializer\Normalizer\DenormalizerAwareInterface;
use Symfony\Component\Serializer\Normalizer\DenormalizerAwareTrait;
use Symfony\Component\Serializer\Normalizer\DenormalizerInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareTrait;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;
class AdsProjectedCohortValueNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdsProjectedCohortValue::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdsProjectedCohortValue::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdsProjectedCohortValue();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('value', $data) && \is_int($data['value'])) {
            $data['value'] = (float) $data['value'];
        }
        if (\array_key_exists('low', $data) && \is_int($data['low'])) {
            $data['low'] = (float) $data['low'];
        }
        if (\array_key_exists('high', $data) && \is_int($data['high'])) {
            $data['high'] = (float) $data['high'];
        }
        if (\array_key_exists('isPartial', $data) && \is_int($data['isPartial'])) {
            $data['isPartial'] = (bool) $data['isPartial'];
        }
        if (\array_key_exists('value', $data)) {
            $object->setValue($data['value']);
        }
        if (\array_key_exists('low', $data)) {
            $object->setLow($data['low']);
        }
        if (\array_key_exists('high', $data)) {
            $object->setHigh($data['high']);
        }
        if (\array_key_exists('isPartial', $data)) {
            $object->setIsPartial($data['isPartial']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['value'] = $data->getValue();
        $dataArray['low'] = $data->getLow();
        $dataArray['high'] = $data->getHigh();
        $dataArray['isPartial'] = $data->getIsPartial();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdsProjectedCohortValue::class => false];
    }
}