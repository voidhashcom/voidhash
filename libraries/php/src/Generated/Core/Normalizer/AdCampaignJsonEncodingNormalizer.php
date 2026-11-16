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
class AdCampaignJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdCampaignJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdCampaignJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdCampaignJsonEncoding();
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
        if (\array_key_exists('objective', $data) && $data['objective'] !== null) {
            $object->setObjective($data['objective']);
        }
        elseif (\array_key_exists('objective', $data) && $data['objective'] === null) {
            $object->setObjective(null);
        }
        if (\array_key_exists('bidStrategy', $data) && $data['bidStrategy'] !== null) {
            $object->setBidStrategy($data['bidStrategy']);
        }
        elseif (\array_key_exists('bidStrategy', $data) && $data['bidStrategy'] === null) {
            $object->setBidStrategy(null);
        }
        if (\array_key_exists('spendCap', $data)) {
            $object->setSpendCap($this->denormalizer->denormalize($data['spendCap'], \Voidhash\Generated\Core\Model\AdAmount::class, 'json', $context));
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
        $dataArray['objective'] = $data->getObjective();
        $dataArray['bidStrategy'] = $data->getBidStrategy();
        $dataArray['spendCap'] = $this->normalizer->normalize($data->getSpendCap(), 'json', $context);
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdCampaignJsonEncoding::class => false];
    }
}