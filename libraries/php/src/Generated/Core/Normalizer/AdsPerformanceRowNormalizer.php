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
class AdsPerformanceRowNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdsPerformanceRow::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdsPerformanceRow::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdsPerformanceRow();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('campaignId', $data)) {
            $object->setCampaignId($data['campaignId']);
        }
        if (\array_key_exists('adGroupId', $data) && $data['adGroupId'] !== null) {
            $object->setAdGroupId($data['adGroupId']);
        }
        elseif (\array_key_exists('adGroupId', $data) && $data['adGroupId'] === null) {
            $object->setAdGroupId(null);
        }
        if (\array_key_exists('deliveryStatus', $data)) {
            $object->setDeliveryStatus($data['deliveryStatus']);
        }
        if (\array_key_exists('destination', $data)) {
            $object->setDestination($data['destination']);
        }
        if (\array_key_exists('platformUrl', $data)) {
            $object->setPlatformUrl($data['platformUrl']);
        }
        if (\array_key_exists('reported', $data)) {
            $object->setReported($this->denormalizer->denormalize($data['reported'], \Voidhash\Generated\Core\Model\AdsReportedMetrics::class, 'json', $context));
        }
        if (\array_key_exists('measured', $data)) {
            $object->setMeasured($this->denormalizer->denormalize($data['measured'], \Voidhash\Generated\Core\Model\AdsMeasuredMetrics::class, 'json', $context));
        }
        if (\array_key_exists('modeled', $data)) {
            $object->setModeled($this->denormalizer->denormalize($data['modeled'], \Voidhash\Generated\Core\Model\AdsModeledMetrics::class, 'json', $context));
        }
        if (\array_key_exists('breakdown', $data) && $data['breakdown'] !== null) {
            $values = [];
            foreach ($data['breakdown'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AdsPerformanceRowBreakdownItem::class, 'json', $context);
            }
            $object->setBreakdown($values);
        }
        elseif (\array_key_exists('breakdown', $data) && $data['breakdown'] === null) {
            $object->setBreakdown(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['name'] = $data->getName();
        $dataArray['campaignId'] = $data->getCampaignId();
        $dataArray['adGroupId'] = $data->getAdGroupId();
        $dataArray['deliveryStatus'] = $data->getDeliveryStatus();
        $dataArray['destination'] = $data->getDestination();
        $dataArray['platformUrl'] = $data->getPlatformUrl();
        $dataArray['reported'] = $this->normalizer->normalize($data->getReported(), 'json', $context);
        $dataArray['measured'] = $this->normalizer->normalize($data->getMeasured(), 'json', $context);
        $dataArray['modeled'] = $this->normalizer->normalize($data->getModeled(), 'json', $context);
        $values = [];
        foreach ($data->getBreakdown() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['breakdown'] = $values;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdsPerformanceRow::class => false];
    }
}