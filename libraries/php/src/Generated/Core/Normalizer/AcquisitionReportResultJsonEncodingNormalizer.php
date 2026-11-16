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
class AcquisitionReportResultJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('projectId', $data)) {
            $object->setProjectId($data['projectId']);
        }
        if (\array_key_exists('level', $data)) {
            $object->setLevel($data['level']);
        }
        if (\array_key_exists('network', $data) && $data['network'] !== null) {
            $object->setNetwork($data['network']);
        }
        elseif (\array_key_exists('network', $data) && $data['network'] === null) {
            $object->setNetwork(null);
        }
        if (\array_key_exists('campaignId', $data) && $data['campaignId'] !== null) {
            $object->setCampaignId($data['campaignId']);
        }
        elseif (\array_key_exists('campaignId', $data) && $data['campaignId'] === null) {
            $object->setCampaignId(null);
        }
        if (\array_key_exists('adsetId', $data) && $data['adsetId'] !== null) {
            $object->setAdsetId($data['adsetId']);
        }
        elseif (\array_key_exists('adsetId', $data) && $data['adsetId'] === null) {
            $object->setAdsetId(null);
        }
        if (\array_key_exists('adId', $data) && $data['adId'] !== null) {
            $object->setAdId($data['adId']);
        }
        elseif (\array_key_exists('adId', $data) && $data['adId'] === null) {
            $object->setAdId(null);
        }
        if (\array_key_exists('currency', $data)) {
            $object->setCurrency($data['currency']);
        }
        if (\array_key_exists('timezone', $data)) {
            $object->setTimezone($data['timezone']);
        }
        if (\array_key_exists('environment', $data)) {
            $object->setEnvironment($data['environment']);
        }
        if (\array_key_exists('keyConversion', $data)) {
            $object->setKeyConversion($data['keyConversion']);
        }
        if (\array_key_exists('from', $data)) {
            $object->setFrom($data['from']);
        }
        if (\array_key_exists('to', $data)) {
            $object->setTo($data['to']);
        }
        if (\array_key_exists('start', $data)) {
            $object->setStart($data['start']);
        }
        if (\array_key_exists('end', $data)) {
            $object->setEnd($data['end']);
        }
        if (\array_key_exists('revenueWindow', $data)) {
            $object->setRevenueWindow($data['revenueWindow']);
        }
        if (\array_key_exists('attributionWindowDays', $data)) {
            $object->setAttributionWindowDays($data['attributionWindowDays']);
        }
        if (\array_key_exists('revenueEnd', $data)) {
            $object->setRevenueEnd($data['revenueEnd']);
        }
        if (\array_key_exists('groups', $data)) {
            $values = [];
            foreach ($data['groups'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AcquisitionGroup::class, 'json', $context);
            }
            $object->setGroups($values);
        }
        if (\array_key_exists('unattributed', $data) && $data['unattributed'] !== null) {
            $object->setUnattributed($this->denormalizer->denormalize($data['unattributed'], \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingUnattributed::class, 'json', $context));
        }
        elseif (\array_key_exists('unattributed', $data) && $data['unattributed'] === null) {
            $object->setUnattributed(null);
        }
        if (\array_key_exists('totals', $data)) {
            $object->setTotals($this->denormalizer->denormalize($data['totals'], \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingTotals::class, 'json', $context));
        }
        if (\array_key_exists('selfReported', $data) && $data['selfReported'] !== null) {
            $values_1 = [];
            foreach ($data['selfReported'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingSelfReportedItem::class, 'json', $context);
            }
            $object->setSelfReported($values_1);
        }
        elseif (\array_key_exists('selfReported', $data) && $data['selfReported'] === null) {
            $object->setSelfReported(null);
        }
        if (\array_key_exists('funnel', $data)) {
            $values_2 = [];
            foreach ($data['funnel'] as $value_2) {
                $values_2[] = $this->denormalizer->denormalize($value_2, \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingFunnelItem::class, 'json', $context);
            }
            $object->setFunnel($values_2);
        }
        if (\array_key_exists('convertedOn', $data)) {
            $object->setConvertedOn($this->denormalizer->denormalize($data['convertedOn'], \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingConvertedOn::class, 'json', $context));
        }
        if (\array_key_exists('coverage', $data)) {
            $object->setCoverage($this->denormalizer->denormalize($data['coverage'], \Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncodingCoverage::class, 'json', $context));
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['projectId'] = $data->getProjectId();
        $dataArray['level'] = $data->getLevel();
        $dataArray['network'] = $data->getNetwork();
        $dataArray['campaignId'] = $data->getCampaignId();
        $dataArray['adsetId'] = $data->getAdsetId();
        $dataArray['adId'] = $data->getAdId();
        $dataArray['currency'] = $data->getCurrency();
        $dataArray['timezone'] = $data->getTimezone();
        $dataArray['environment'] = $data->getEnvironment();
        $dataArray['keyConversion'] = $data->getKeyConversion();
        $dataArray['from'] = $data->getFrom();
        $dataArray['to'] = $data->getTo();
        $dataArray['start'] = $data->getStart();
        $dataArray['end'] = $data->getEnd();
        $dataArray['revenueWindow'] = $data->getRevenueWindow();
        $dataArray['attributionWindowDays'] = $data->getAttributionWindowDays();
        $dataArray['revenueEnd'] = $data->getRevenueEnd();
        $values = [];
        foreach ($data->getGroups() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['groups'] = $values;
        $dataArray['unattributed'] = $this->normalizer->normalize($data->getUnattributed(), 'json', $context);
        $dataArray['totals'] = $this->normalizer->normalize($data->getTotals(), 'json', $context);
        $values_1 = [];
        foreach ($data->getSelfReported() as $value_1) {
            $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
        }
        $dataArray['selfReported'] = $values_1;
        $values_2 = [];
        foreach ($data->getFunnel() as $value_2) {
            $values_2[] = $this->normalizer->normalize($value_2, 'json', $context);
        }
        $dataArray['funnel'] = $values_2;
        $dataArray['convertedOn'] = $this->normalizer->normalize($data->getConvertedOn(), 'json', $context);
        $dataArray['coverage'] = $this->normalizer->normalize($data->getCoverage(), 'json', $context);
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncoding::class => false];
    }
}