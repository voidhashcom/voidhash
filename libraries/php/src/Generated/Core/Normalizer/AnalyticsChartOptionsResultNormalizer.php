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
class AnalyticsChartOptionsResultNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AnalyticsChartOptionsResult::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AnalyticsChartOptionsResult::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AnalyticsChartOptionsResult();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('shape', $data)) {
            $object->setShape($data['shape']);
        }
        if (\array_key_exists('platforms', $data)) {
            $values = [];
            foreach ($data['platforms'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\Objects1::class, 'json', $context);
            }
            $object->setPlatforms($values);
        }
        if (\array_key_exists('countries', $data)) {
            $values_1 = [];
            foreach ($data['countries'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\Objects1::class, 'json', $context);
            }
            $object->setCountries($values_1);
        }
        if (\array_key_exists('appVersions', $data)) {
            $values_2 = [];
            foreach ($data['appVersions'] as $value_2) {
                $values_2[] = $this->denormalizer->denormalize($value_2, \Voidhash\Generated\Core\Model\Objects1::class, 'json', $context);
            }
            $object->setAppVersions($values_2);
        }
        if (\array_key_exists('products', $data)) {
            $values_3 = [];
            foreach ($data['products'] as $value_3) {
                $values_3[] = $this->denormalizer->denormalize($value_3, \Voidhash\Generated\Core\Model\Objects1::class, 'json', $context);
            }
            $object->setProducts($values_3);
        }
        if (\array_key_exists('stores', $data)) {
            $values_4 = [];
            foreach ($data['stores'] as $value_4) {
                $values_4[] = $this->denormalizer->denormalize($value_4, \Voidhash\Generated\Core\Model\Objects1::class, 'json', $context);
            }
            $object->setStores($values_4);
        }
        if (\array_key_exists('packageSources', $data)) {
            $values_5 = [];
            foreach ($data['packageSources'] as $value_5) {
                $values_5[] = $this->denormalizer->denormalize($value_5, \Voidhash\Generated\Core\Model\Objects1::class, 'json', $context);
            }
            $object->setPackageSources($values_5);
        }
        if (\array_key_exists('placements', $data)) {
            $values_6 = [];
            foreach ($data['placements'] as $value_6) {
                $values_6[] = $this->denormalizer->denormalize($value_6, \Voidhash\Generated\Core\Model\Objects1::class, 'json', $context);
            }
            $object->setPlacements($values_6);
        }
        if (\array_key_exists('paywalls', $data)) {
            $values_7 = [];
            foreach ($data['paywalls'] as $value_7) {
                $values_7[] = $this->denormalizer->denormalize($value_7, \Voidhash\Generated\Core\Model\Objects1::class, 'json', $context);
            }
            $object->setPaywalls($values_7);
        }
        if (\array_key_exists('offers', $data)) {
            $values_8 = [];
            foreach ($data['offers'] as $value_8) {
                $values_8[] = $this->denormalizer->denormalize($value_8, \Voidhash\Generated\Core\Model\Objects1::class, 'json', $context);
            }
            $object->setOffers($values_8);
        }
        if (\array_key_exists('acquisitionSources', $data)) {
            $values_9 = [];
            foreach ($data['acquisitionSources'] as $value_9) {
                $values_9[] = $this->denormalizer->denormalize($value_9, \Voidhash\Generated\Core\Model\Objects1::class, 'json', $context);
            }
            $object->setAcquisitionSources($values_9);
        }
        if (\array_key_exists('experiments', $data)) {
            $values_10 = [];
            foreach ($data['experiments'] as $value_10) {
                $values_10[] = $this->denormalizer->denormalize($value_10, \Voidhash\Generated\Core\Model\Objects1::class, 'json', $context);
            }
            $object->setExperiments($values_10);
        }
        if (\array_key_exists('events', $data)) {
            $values_11 = [];
            foreach ($data['events'] as $value_11) {
                $values_11[] = $this->denormalizer->denormalize($value_11, \Voidhash\Generated\Core\Model\Objects1::class, 'json', $context);
            }
            $object->setEvents($values_11);
        }
        if (\array_key_exists('traits', $data)) {
            $values_12 = [];
            foreach ($data['traits'] as $value_12) {
                $values_12[] = $this->denormalizer->denormalize($value_12, \Voidhash\Generated\Core\Model\Objects1::class, 'json', $context);
            }
            $object->setTraits($values_12);
        }
        if (\array_key_exists('properties', $data)) {
            $values_13 = [];
            foreach ($data['properties'] as $value_13) {
                $values_13[] = $this->denormalizer->denormalize($value_13, \Voidhash\Generated\Core\Model\Objects1::class, 'json', $context);
            }
            $object->setProperties($values_13);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['shape'] = $data->getShape();
        $values = [];
        foreach ($data->getPlatforms() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['platforms'] = $values;
        $values_1 = [];
        foreach ($data->getCountries() as $value_1) {
            $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
        }
        $dataArray['countries'] = $values_1;
        $values_2 = [];
        foreach ($data->getAppVersions() as $value_2) {
            $values_2[] = $this->normalizer->normalize($value_2, 'json', $context);
        }
        $dataArray['appVersions'] = $values_2;
        $values_3 = [];
        foreach ($data->getProducts() as $value_3) {
            $values_3[] = $this->normalizer->normalize($value_3, 'json', $context);
        }
        $dataArray['products'] = $values_3;
        $values_4 = [];
        foreach ($data->getStores() as $value_4) {
            $values_4[] = $this->normalizer->normalize($value_4, 'json', $context);
        }
        $dataArray['stores'] = $values_4;
        $values_5 = [];
        foreach ($data->getPackageSources() as $value_5) {
            $values_5[] = $this->normalizer->normalize($value_5, 'json', $context);
        }
        $dataArray['packageSources'] = $values_5;
        $values_6 = [];
        foreach ($data->getPlacements() as $value_6) {
            $values_6[] = $this->normalizer->normalize($value_6, 'json', $context);
        }
        $dataArray['placements'] = $values_6;
        $values_7 = [];
        foreach ($data->getPaywalls() as $value_7) {
            $values_7[] = $this->normalizer->normalize($value_7, 'json', $context);
        }
        $dataArray['paywalls'] = $values_7;
        $values_8 = [];
        foreach ($data->getOffers() as $value_8) {
            $values_8[] = $this->normalizer->normalize($value_8, 'json', $context);
        }
        $dataArray['offers'] = $values_8;
        $values_9 = [];
        foreach ($data->getAcquisitionSources() as $value_9) {
            $values_9[] = $this->normalizer->normalize($value_9, 'json', $context);
        }
        $dataArray['acquisitionSources'] = $values_9;
        $values_10 = [];
        foreach ($data->getExperiments() as $value_10) {
            $values_10[] = $this->normalizer->normalize($value_10, 'json', $context);
        }
        $dataArray['experiments'] = $values_10;
        $values_11 = [];
        foreach ($data->getEvents() as $value_11) {
            $values_11[] = $this->normalizer->normalize($value_11, 'json', $context);
        }
        $dataArray['events'] = $values_11;
        $values_12 = [];
        foreach ($data->getTraits() as $value_12) {
            $values_12[] = $this->normalizer->normalize($value_12, 'json', $context);
        }
        $dataArray['traits'] = $values_12;
        $values_13 = [];
        foreach ($data->getProperties() as $value_13) {
            $values_13[] = $this->normalizer->normalize($value_13, 'json', $context);
        }
        $dataArray['properties'] = $values_13;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AnalyticsChartOptionsResult::class => false];
    }
}