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
class CreateAnalyticsAlertBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\CreateAnalyticsAlertBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\CreateAnalyticsAlertBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\CreateAnalyticsAlertBodyJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('threshold', $data) && \is_int($data['threshold'])) {
            $data['threshold'] = (float) $data['threshold'];
        }
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('kind', $data)) {
            $object->setKind($data['kind']);
        }
        if (\array_key_exists('eventName', $data)) {
            $object->setEventName($data['eventName']);
        }
        if (\array_key_exists('successEventName', $data) && $data['successEventName'] !== null) {
            $object->setSuccessEventName($data['successEventName']);
        }
        elseif (\array_key_exists('successEventName', $data) && $data['successEventName'] === null) {
            $object->setSuccessEventName(null);
        }
        if (\array_key_exists('windowHours', $data)) {
            $object->setWindowHours($data['windowHours']);
        }
        if (\array_key_exists('threshold', $data)) {
            $object->setThreshold($data['threshold']);
        }
        if (\array_key_exists('minPeople', $data) && $data['minPeople'] !== null) {
            $object->setMinPeople($data['minPeople']);
        }
        elseif (\array_key_exists('minPeople', $data) && $data['minPeople'] === null) {
            $object->setMinPeople(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['name'] = $data->getName();
        $dataArray['kind'] = $data->getKind();
        $dataArray['eventName'] = $data->getEventName();
        if ($data->isInitialized('successEventName')) {
            $dataArray['successEventName'] = $data->getSuccessEventName();
        }
        $dataArray['windowHours'] = $data->getWindowHours();
        $dataArray['threshold'] = $data->getThreshold();
        if ($data->isInitialized('minPeople')) {
            $dataArray['minPeople'] = $data->getMinPeople();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\CreateAnalyticsAlertBodyJsonEncoding::class => false];
    }
}