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
class AdsPerformanceReportBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdsPerformanceReportBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdsPerformanceReportBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdsPerformanceReportBodyJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('from', $data)) {
            $object->setFrom($data['from']);
        }
        if (\array_key_exists('to', $data)) {
            $object->setTo($data['to']);
        }
        if (\array_key_exists('currency', $data) && $data['currency'] !== null) {
            $object->setCurrency($data['currency']);
        }
        elseif (\array_key_exists('currency', $data) && $data['currency'] === null) {
            $object->setCurrency(null);
        }
        if (\array_key_exists('timezone', $data) && $data['timezone'] !== null) {
            $object->setTimezone($data['timezone']);
        }
        elseif (\array_key_exists('timezone', $data) && $data['timezone'] === null) {
            $object->setTimezone(null);
        }
        if (\array_key_exists('environment', $data) && $data['environment'] !== null) {
            $object->setEnvironment($data['environment']);
        }
        elseif (\array_key_exists('environment', $data) && $data['environment'] === null) {
            $object->setEnvironment(null);
        }
        if (\array_key_exists('level', $data)) {
            $object->setLevel($data['level']);
        }
        if (\array_key_exists('breakdown', $data)) {
            $object->setBreakdown($data['breakdown']);
        }
        if (\array_key_exists('campaignIds', $data) && $data['campaignIds'] !== null) {
            $values = [];
            foreach ($data['campaignIds'] as $value) {
                $values[] = $value;
            }
            $object->setCampaignIds($values);
        }
        elseif (\array_key_exists('campaignIds', $data) && $data['campaignIds'] === null) {
            $object->setCampaignIds(null);
        }
        if (\array_key_exists('adGroupIds', $data) && $data['adGroupIds'] !== null) {
            $values_1 = [];
            foreach ($data['adGroupIds'] as $value_1) {
                $values_1[] = $value_1;
            }
            $object->setAdGroupIds($values_1);
        }
        elseif (\array_key_exists('adGroupIds', $data) && $data['adGroupIds'] === null) {
            $object->setAdGroupIds(null);
        }
        if (\array_key_exists('delivery', $data) && $data['delivery'] !== null) {
            $object->setDelivery($data['delivery']);
        }
        elseif (\array_key_exists('delivery', $data) && $data['delivery'] === null) {
            $object->setDelivery(null);
        }
        if (\array_key_exists('destination', $data) && $data['destination'] !== null) {
            $object->setDestination($data['destination']);
        }
        elseif (\array_key_exists('destination', $data) && $data['destination'] === null) {
            $object->setDestination(null);
        }
        if (\array_key_exists('search', $data) && $data['search'] !== null) {
            $object->setSearch($data['search']);
        }
        elseif (\array_key_exists('search', $data) && $data['search'] === null) {
            $object->setSearch(null);
        }
        if (\array_key_exists('include', $data) && $data['include'] !== null) {
            $values_2 = [];
            foreach ($data['include'] as $value_2) {
                $values_2[] = $value_2;
            }
            $object->setInclude($values_2);
        }
        elseif (\array_key_exists('include', $data) && $data['include'] === null) {
            $object->setInclude(null);
        }
        if (\array_key_exists('sort', $data) && $data['sort'] !== null) {
            $object->setSort($this->denormalizer->denormalize($data['sort'], \Voidhash\Generated\Core\Model\AdsPerformanceReportBodyJsonEncodingSort::class, 'json', $context));
        }
        elseif (\array_key_exists('sort', $data) && $data['sort'] === null) {
            $object->setSort(null);
        }
        if (\array_key_exists('limit', $data) && $data['limit'] !== null) {
            $object->setLimit($data['limit']);
        }
        elseif (\array_key_exists('limit', $data) && $data['limit'] === null) {
            $object->setLimit(null);
        }
        if (\array_key_exists('cursor', $data) && $data['cursor'] !== null) {
            $object->setCursor($data['cursor']);
        }
        elseif (\array_key_exists('cursor', $data) && $data['cursor'] === null) {
            $object->setCursor(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['from'] = $data->getFrom();
        $dataArray['to'] = $data->getTo();
        if ($data->isInitialized('currency')) {
            $dataArray['currency'] = $data->getCurrency();
        }
        if ($data->isInitialized('timezone')) {
            $dataArray['timezone'] = $data->getTimezone();
        }
        if ($data->isInitialized('environment')) {
            $dataArray['environment'] = $data->getEnvironment();
        }
        $dataArray['level'] = $data->getLevel();
        if ($data->isInitialized('breakdown') && null !== $data->getBreakdown()) {
            $dataArray['breakdown'] = $data->getBreakdown();
        }
        if ($data->isInitialized('campaignIds')) {
            $values = [];
            foreach ($data->getCampaignIds() as $value) {
                $values[] = $value;
            }
            $dataArray['campaignIds'] = $values;
        }
        if ($data->isInitialized('adGroupIds')) {
            $values_1 = [];
            foreach ($data->getAdGroupIds() as $value_1) {
                $values_1[] = $value_1;
            }
            $dataArray['adGroupIds'] = $values_1;
        }
        if ($data->isInitialized('delivery')) {
            $dataArray['delivery'] = $data->getDelivery();
        }
        if ($data->isInitialized('destination')) {
            $dataArray['destination'] = $data->getDestination();
        }
        if ($data->isInitialized('search')) {
            $dataArray['search'] = $data->getSearch();
        }
        if ($data->isInitialized('include')) {
            $values_2 = [];
            foreach ($data->getInclude() as $value_2) {
                $values_2[] = $value_2;
            }
            $dataArray['include'] = $values_2;
        }
        if ($data->isInitialized('sort')) {
            $dataArray['sort'] = $this->normalizer->normalize($data->getSort(), 'json', $context);
        }
        if ($data->isInitialized('limit')) {
            $dataArray['limit'] = $data->getLimit();
        }
        if ($data->isInitialized('cursor')) {
            $dataArray['cursor'] = $data->getCursor();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdsPerformanceReportBodyJsonEncoding::class => false];
    }
}