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
class AnalyticsChartExcludedFiltersNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AnalyticsChartExcludedFilters::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AnalyticsChartExcludedFilters::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AnalyticsChartExcludedFilters();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('appVersions', $data) && $data['appVersions'] !== null) {
            $values = [];
            foreach ($data['appVersions'] as $value) {
                $values[] = $value;
            }
            $object->setAppVersions($values);
        }
        elseif (\array_key_exists('appVersions', $data) && $data['appVersions'] === null) {
            $object->setAppVersions(null);
        }
        if (\array_key_exists('cohortIds', $data) && $data['cohortIds'] !== null) {
            $values_1 = [];
            foreach ($data['cohortIds'] as $value_1) {
                $values_1[] = $value_1;
            }
            $object->setCohortIds($values_1);
        }
        elseif (\array_key_exists('cohortIds', $data) && $data['cohortIds'] === null) {
            $object->setCohortIds(null);
        }
        if (\array_key_exists('countries', $data) && $data['countries'] !== null) {
            $values_2 = [];
            foreach ($data['countries'] as $value_2) {
                $values_2[] = $value_2;
            }
            $object->setCountries($values_2);
        }
        elseif (\array_key_exists('countries', $data) && $data['countries'] === null) {
            $object->setCountries(null);
        }
        if (\array_key_exists('packageSources', $data) && $data['packageSources'] !== null) {
            $values_3 = [];
            foreach ($data['packageSources'] as $value_3) {
                $values_3[] = $value_3;
            }
            $object->setPackageSources($values_3);
        }
        elseif (\array_key_exists('packageSources', $data) && $data['packageSources'] === null) {
            $object->setPackageSources(null);
        }
        if (\array_key_exists('platforms', $data) && $data['platforms'] !== null) {
            $values_4 = [];
            foreach ($data['platforms'] as $value_4) {
                $values_4[] = $value_4;
            }
            $object->setPlatforms($values_4);
        }
        elseif (\array_key_exists('platforms', $data) && $data['platforms'] === null) {
            $object->setPlatforms(null);
        }
        if (\array_key_exists('productIds', $data) && $data['productIds'] !== null) {
            $values_5 = [];
            foreach ($data['productIds'] as $value_5) {
                $values_5[] = $value_5;
            }
            $object->setProductIds($values_5);
        }
        elseif (\array_key_exists('productIds', $data) && $data['productIds'] === null) {
            $object->setProductIds(null);
        }
        if (\array_key_exists('stores', $data) && $data['stores'] !== null) {
            $values_6 = [];
            foreach ($data['stores'] as $value_6) {
                $values_6[] = $value_6;
            }
            $object->setStores($values_6);
        }
        elseif (\array_key_exists('stores', $data) && $data['stores'] === null) {
            $object->setStores(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        if ($data->isInitialized('appVersions')) {
            $values = [];
            foreach ($data->getAppVersions() as $value) {
                $values[] = $value;
            }
            $dataArray['appVersions'] = $values;
        }
        if ($data->isInitialized('cohortIds')) {
            $values_1 = [];
            foreach ($data->getCohortIds() as $value_1) {
                $values_1[] = $value_1;
            }
            $dataArray['cohortIds'] = $values_1;
        }
        if ($data->isInitialized('countries')) {
            $values_2 = [];
            foreach ($data->getCountries() as $value_2) {
                $values_2[] = $value_2;
            }
            $dataArray['countries'] = $values_2;
        }
        if ($data->isInitialized('packageSources')) {
            $values_3 = [];
            foreach ($data->getPackageSources() as $value_3) {
                $values_3[] = $value_3;
            }
            $dataArray['packageSources'] = $values_3;
        }
        if ($data->isInitialized('platforms')) {
            $values_4 = [];
            foreach ($data->getPlatforms() as $value_4) {
                $values_4[] = $value_4;
            }
            $dataArray['platforms'] = $values_4;
        }
        if ($data->isInitialized('productIds')) {
            $values_5 = [];
            foreach ($data->getProductIds() as $value_5) {
                $values_5[] = $value_5;
            }
            $dataArray['productIds'] = $values_5;
        }
        if ($data->isInitialized('stores')) {
            $values_6 = [];
            foreach ($data->getStores() as $value_6) {
                $values_6[] = $value_6;
            }
            $dataArray['stores'] = $values_6;
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AnalyticsChartExcludedFilters::class => false];
    }
}