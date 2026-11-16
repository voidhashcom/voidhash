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
class AdsRevisionNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdsRevision::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdsRevision::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdsRevision();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('readAt', $data)) {
            $object->setReadAt($data['readAt']);
        }
        if (\array_key_exists('date', $data)) {
            $object->setDate($data['date']);
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
        if (\array_key_exists('spend', $data)) {
            $object->setSpend($data['spend']);
        }
        if (\array_key_exists('impressions', $data)) {
            $object->setImpressions($data['impressions']);
        }
        if (\array_key_exists('clicks', $data)) {
            $object->setClicks($data['clicks']);
        }
        if (\array_key_exists('linkClicks', $data)) {
            $object->setLinkClicks($data['linkClicks']);
        }
        if (\array_key_exists('results', $data)) {
            $values = [];
            foreach ($data['results'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AdsResultChange::class, 'json', $context);
            }
            $object->setResults($values);
        }
        if (\array_key_exists('conversions', $data)) {
            $values_1 = [];
            foreach ($data['conversions'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\AdsConversionChange::class, 'json', $context);
            }
            $object->setConversions($values_1);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['readAt'] = $data->getReadAt();
        $dataArray['date'] = $data->getDate();
        $dataArray['adAccountId'] = $data->getAdAccountId();
        $dataArray['level'] = $data->getLevel();
        $dataArray['id'] = $data->getId();
        $dataArray['name'] = $data->getName();
        $dataArray['campaignId'] = $data->getCampaignId();
        $dataArray['adGroupId'] = $data->getAdGroupId();
        $dataArray['currency'] = $data->getCurrency();
        $dataArray['spend'] = $data->getSpend();
        $dataArray['impressions'] = $data->getImpressions();
        $dataArray['clicks'] = $data->getClicks();
        $dataArray['linkClicks'] = $data->getLinkClicks();
        $values = [];
        foreach ($data->getResults() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['results'] = $values;
        $values_1 = [];
        foreach ($data->getConversions() as $value_1) {
            $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
        }
        $dataArray['conversions'] = $values_1;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdsRevision::class => false];
    }
}