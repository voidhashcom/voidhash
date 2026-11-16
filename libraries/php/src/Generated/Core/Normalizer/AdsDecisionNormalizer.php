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
class AdsDecisionNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdsDecision::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdsDecision::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdsDecision();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('kind', $data)) {
            $object->setKind($data['kind']);
        }
        if (\array_key_exists('changedAt', $data)) {
            $object->setChangedAt($data['changedAt']);
        }
        if (\array_key_exists('detectedAt', $data)) {
            $object->setDetectedAt($data['detectedAt']);
        }
        if (\array_key_exists('adAccountId', $data)) {
            $object->setAdAccountId($data['adAccountId']);
        }
        if (\array_key_exists('level', $data)) {
            $object->setLevel($data['level']);
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
        if (\array_key_exists('currency', $data)) {
            $object->setCurrency($data['currency']);
        }
        if (\array_key_exists('before', $data)) {
            $object->setBefore($this->denormalizer->denormalize($data['before'], \Voidhash\Generated\Core\Model\AdsObjectSettings::class, 'json', $context));
        }
        if (\array_key_exists('after', $data)) {
            $object->setAfter($this->denormalizer->denormalize($data['after'], \Voidhash\Generated\Core\Model\AdsObjectSettings::class, 'json', $context));
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['kind'] = $data->getKind();
        $dataArray['changedAt'] = $data->getChangedAt();
        $dataArray['detectedAt'] = $data->getDetectedAt();
        $dataArray['adAccountId'] = $data->getAdAccountId();
        $dataArray['level'] = $data->getLevel();
        $dataArray['id'] = $data->getId();
        $dataArray['name'] = $data->getName();
        $dataArray['campaignId'] = $data->getCampaignId();
        $dataArray['adGroupId'] = $data->getAdGroupId();
        $dataArray['currency'] = $data->getCurrency();
        $dataArray['before'] = $this->normalizer->normalize($data->getBefore(), 'json', $context);
        $dataArray['after'] = $this->normalizer->normalize($data->getAfter(), 'json', $context);
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdsDecision::class => false];
    }
}