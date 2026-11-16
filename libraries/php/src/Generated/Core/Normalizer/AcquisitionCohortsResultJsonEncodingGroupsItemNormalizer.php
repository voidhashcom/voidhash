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
class AcquisitionCohortsResultJsonEncodingGroupsItemNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AcquisitionCohortsResultJsonEncodingGroupsItem::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AcquisitionCohortsResultJsonEncodingGroupsItem::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AcquisitionCohortsResultJsonEncodingGroupsItem();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
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
        if (\array_key_exists('campaignName', $data) && $data['campaignName'] !== null) {
            $object->setCampaignName($data['campaignName']);
        }
        elseif (\array_key_exists('campaignName', $data) && $data['campaignName'] === null) {
            $object->setCampaignName(null);
        }
        if (\array_key_exists('adsetId', $data) && $data['adsetId'] !== null) {
            $object->setAdsetId($data['adsetId']);
        }
        elseif (\array_key_exists('adsetId', $data) && $data['adsetId'] === null) {
            $object->setAdsetId(null);
        }
        if (\array_key_exists('adsetName', $data) && $data['adsetName'] !== null) {
            $object->setAdsetName($data['adsetName']);
        }
        elseif (\array_key_exists('adsetName', $data) && $data['adsetName'] === null) {
            $object->setAdsetName(null);
        }
        if (\array_key_exists('adId', $data) && $data['adId'] !== null) {
            $object->setAdId($data['adId']);
        }
        elseif (\array_key_exists('adId', $data) && $data['adId'] === null) {
            $object->setAdId(null);
        }
        if (\array_key_exists('adName', $data) && $data['adName'] !== null) {
            $object->setAdName($data['adName']);
        }
        elseif (\array_key_exists('adName', $data) && $data['adName'] === null) {
            $object->setAdName(null);
        }
        if (\array_key_exists('surface', $data) && $data['surface'] !== null) {
            $object->setSurface($data['surface']);
        }
        elseif (\array_key_exists('surface', $data) && $data['surface'] === null) {
            $object->setSurface(null);
        }
        if (\array_key_exists('cohorts', $data)) {
            $values = [];
            foreach ($data['cohorts'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AcquisitionCohort::class, 'json', $context);
            }
            $object->setCohorts($values);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['network'] = $data->getNetwork();
        $dataArray['campaignId'] = $data->getCampaignId();
        $dataArray['campaignName'] = $data->getCampaignName();
        $dataArray['adsetId'] = $data->getAdsetId();
        $dataArray['adsetName'] = $data->getAdsetName();
        $dataArray['adId'] = $data->getAdId();
        $dataArray['adName'] = $data->getAdName();
        $dataArray['surface'] = $data->getSurface();
        $values = [];
        foreach ($data->getCohorts() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['cohorts'] = $values;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AcquisitionCohortsResultJsonEncodingGroupsItem::class => false];
    }
}