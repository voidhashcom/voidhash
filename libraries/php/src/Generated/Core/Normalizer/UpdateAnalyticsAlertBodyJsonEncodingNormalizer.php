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
class UpdateAnalyticsAlertBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\UpdateAnalyticsAlertBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\UpdateAnalyticsAlertBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\UpdateAnalyticsAlertBodyJsonEncoding();
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
        if (\array_key_exists('isEnabled', $data) && \is_int($data['isEnabled'])) {
            $data['isEnabled'] = (bool) $data['isEnabled'];
        }
        if (\array_key_exists('name', $data) && $data['name'] !== null) {
            $object->setName($data['name']);
        }
        elseif (\array_key_exists('name', $data) && $data['name'] === null) {
            $object->setName(null);
        }
        if (\array_key_exists('eventName', $data) && $data['eventName'] !== null) {
            $object->setEventName($data['eventName']);
        }
        elseif (\array_key_exists('eventName', $data) && $data['eventName'] === null) {
            $object->setEventName(null);
        }
        if (\array_key_exists('metric', $data)) {
            $object->setMetric($this->denormalizer->denormalize($data['metric'], \Voidhash\Generated\Core\Model\AnalyticsAlertMetric::class, 'json', $context));
        }
        if (\array_key_exists('filters', $data)) {
            $values = [];
            foreach ($data['filters'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AnalyticsMetricFilter::class, 'json', $context);
            }
            $object->setFilters($values);
        }
        if (\array_key_exists('direction', $data)) {
            $object->setDirection($data['direction']);
        }
        if (\array_key_exists('currency', $data) && $data['currency'] !== null) {
            $object->setCurrency($data['currency']);
        }
        elseif (\array_key_exists('currency', $data) && $data['currency'] === null) {
            $object->setCurrency(null);
        }
        if (\array_key_exists('successEventName', $data) && $data['successEventName'] !== null) {
            $object->setSuccessEventName($data['successEventName']);
        }
        elseif (\array_key_exists('successEventName', $data) && $data['successEventName'] === null) {
            $object->setSuccessEventName(null);
        }
        if (\array_key_exists('windowHours', $data) && $data['windowHours'] !== null) {
            $object->setWindowHours($data['windowHours']);
        }
        elseif (\array_key_exists('windowHours', $data) && $data['windowHours'] === null) {
            $object->setWindowHours(null);
        }
        if (\array_key_exists('threshold', $data) && $data['threshold'] !== null) {
            $object->setThreshold($data['threshold']);
        }
        elseif (\array_key_exists('threshold', $data) && $data['threshold'] === null) {
            $object->setThreshold(null);
        }
        if (\array_key_exists('minPeople', $data) && $data['minPeople'] !== null) {
            $object->setMinPeople($data['minPeople']);
        }
        elseif (\array_key_exists('minPeople', $data) && $data['minPeople'] === null) {
            $object->setMinPeople(null);
        }
        if (\array_key_exists('isEnabled', $data) && $data['isEnabled'] !== null) {
            $object->setIsEnabled($data['isEnabled']);
        }
        elseif (\array_key_exists('isEnabled', $data) && $data['isEnabled'] === null) {
            $object->setIsEnabled(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        if ($data->isInitialized('name')) {
            $dataArray['name'] = $data->getName();
        }
        if ($data->isInitialized('eventName')) {
            $dataArray['eventName'] = $data->getEventName();
        }
        if ($data->isInitialized('metric') && null !== $data->getMetric()) {
            $dataArray['metric'] = $this->normalizer->normalize($data->getMetric(), 'json', $context);
        }
        if ($data->isInitialized('filters') && null !== $data->getFilters()) {
            $values = [];
            foreach ($data->getFilters() as $value) {
                $values[] = $this->normalizer->normalize($value, 'json', $context);
            }
            $dataArray['filters'] = $values;
        }
        if ($data->isInitialized('direction') && null !== $data->getDirection()) {
            $dataArray['direction'] = $data->getDirection();
        }
        if ($data->isInitialized('currency')) {
            $dataArray['currency'] = $data->getCurrency();
        }
        if ($data->isInitialized('successEventName')) {
            $dataArray['successEventName'] = $data->getSuccessEventName();
        }
        if ($data->isInitialized('windowHours')) {
            $dataArray['windowHours'] = $data->getWindowHours();
        }
        if ($data->isInitialized('threshold')) {
            $dataArray['threshold'] = $data->getThreshold();
        }
        if ($data->isInitialized('minPeople')) {
            $dataArray['minPeople'] = $data->getMinPeople();
        }
        if ($data->isInitialized('isEnabled')) {
            $dataArray['isEnabled'] = $data->getIsEnabled();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\UpdateAnalyticsAlertBodyJsonEncoding::class => false];
    }
}