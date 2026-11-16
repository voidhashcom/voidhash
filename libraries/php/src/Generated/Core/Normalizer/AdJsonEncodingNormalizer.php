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
class AdJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdJsonEncoding();
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
        if (\array_key_exists('projectId', $data)) {
            $object->setProjectId($data['projectId']);
        }
        if (\array_key_exists('adAccountId', $data)) {
            $object->setAdAccountId($data['adAccountId']);
        }
        if (\array_key_exists('platform', $data)) {
            $object->setPlatform($data['platform']);
        }
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        if (\array_key_exists('deliveryStatus', $data)) {
            $object->setDeliveryStatus($data['deliveryStatus']);
        }
        if (\array_key_exists('deliveryReasons', $data)) {
            $values = [];
            foreach ($data['deliveryReasons'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AdDeliveryReason::class, 'json', $context);
            }
            $object->setDeliveryReasons($values);
        }
        if (\array_key_exists('destination', $data)) {
            $object->setDestination($data['destination']);
        }
        if (\array_key_exists('budget', $data)) {
            $object->setBudget($this->denormalizer->denormalize($data['budget'], \Voidhash\Generated\Core\Model\AdBudget::class, 'json', $context));
        }
        if (\array_key_exists('startsAt', $data) && $data['startsAt'] !== null) {
            $object->setStartsAt($data['startsAt']);
        }
        elseif (\array_key_exists('startsAt', $data) && $data['startsAt'] === null) {
            $object->setStartsAt(null);
        }
        if (\array_key_exists('endsAt', $data) && $data['endsAt'] !== null) {
            $object->setEndsAt($data['endsAt']);
        }
        elseif (\array_key_exists('endsAt', $data) && $data['endsAt'] === null) {
            $object->setEndsAt(null);
        }
        if (\array_key_exists('platformUrl', $data)) {
            $object->setPlatformUrl($data['platformUrl']);
        }
        if (\array_key_exists('createdAt', $data) && $data['createdAt'] !== null) {
            $object->setCreatedAt($data['createdAt']);
        }
        elseif (\array_key_exists('createdAt', $data) && $data['createdAt'] === null) {
            $object->setCreatedAt(null);
        }
        if (\array_key_exists('updatedAt', $data) && $data['updatedAt'] !== null) {
            $object->setUpdatedAt($data['updatedAt']);
        }
        elseif (\array_key_exists('updatedAt', $data) && $data['updatedAt'] === null) {
            $object->setUpdatedAt(null);
        }
        if (\array_key_exists('syncedAt', $data)) {
            $object->setSyncedAt($data['syncedAt']);
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
        if (\array_key_exists('creativeId', $data) && $data['creativeId'] !== null) {
            $object->setCreativeId($data['creativeId']);
        }
        elseif (\array_key_exists('creativeId', $data) && $data['creativeId'] === null) {
            $object->setCreativeId(null);
        }
        if (\array_key_exists('landingUrl', $data) && $data['landingUrl'] !== null) {
            $object->setLandingUrl($data['landingUrl']);
        }
        elseif (\array_key_exists('landingUrl', $data) && $data['landingUrl'] === null) {
            $object->setLandingUrl(null);
        }
        if (\array_key_exists('urlParameters', $data) && $data['urlParameters'] !== null) {
            $object->setUrlParameters($data['urlParameters']);
        }
        elseif (\array_key_exists('urlParameters', $data) && $data['urlParameters'] === null) {
            $object->setUrlParameters(null);
        }
        if (\array_key_exists('missingTrackingParameters', $data) && $data['missingTrackingParameters'] !== null) {
            $values_1 = [];
            foreach ($data['missingTrackingParameters'] as $value_1) {
                $values_1[] = $value_1;
            }
            $object->setMissingTrackingParameters($values_1);
        }
        elseif (\array_key_exists('missingTrackingParameters', $data) && $data['missingTrackingParameters'] === null) {
            $object->setMissingTrackingParameters(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['projectId'] = $data->getProjectId();
        $dataArray['adAccountId'] = $data->getAdAccountId();
        $dataArray['platform'] = $data->getPlatform();
        $dataArray['name'] = $data->getName();
        $dataArray['status'] = $data->getStatus();
        $dataArray['deliveryStatus'] = $data->getDeliveryStatus();
        $values = [];
        foreach ($data->getDeliveryReasons() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['deliveryReasons'] = $values;
        $dataArray['destination'] = $data->getDestination();
        $dataArray['budget'] = $this->normalizer->normalize($data->getBudget(), 'json', $context);
        $dataArray['startsAt'] = $data->getStartsAt();
        $dataArray['endsAt'] = $data->getEndsAt();
        $dataArray['platformUrl'] = $data->getPlatformUrl();
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['updatedAt'] = $data->getUpdatedAt();
        $dataArray['syncedAt'] = $data->getSyncedAt();
        $dataArray['campaignId'] = $data->getCampaignId();
        $dataArray['adGroupId'] = $data->getAdGroupId();
        $dataArray['creativeId'] = $data->getCreativeId();
        $dataArray['landingUrl'] = $data->getLandingUrl();
        $dataArray['urlParameters'] = $data->getUrlParameters();
        $values_1 = [];
        foreach ($data->getMissingTrackingParameters() as $value_1) {
            $values_1[] = $value_1;
        }
        $dataArray['missingTrackingParameters'] = $values_1;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdJsonEncoding::class => false];
    }
}