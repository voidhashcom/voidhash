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
class AdAccountJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdAccountJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdAccountJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdAccountJsonEncoding();
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
        if (\array_key_exists('platform', $data)) {
            $object->setPlatform($data['platform']);
        }
        if (\array_key_exists('externalId', $data)) {
            $object->setExternalId($data['externalId']);
        }
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('currency', $data)) {
            $object->setCurrency($data['currency']);
        }
        if (\array_key_exists('timezone', $data)) {
            $object->setTimezone($data['timezone']);
        }
        if (\array_key_exists('backfillDays', $data)) {
            $object->setBackfillDays($data['backfillDays']);
        }
        if (\array_key_exists('syncStatus', $data)) {
            $object->setSyncStatus($data['syncStatus']);
        }
        if (\array_key_exists('lastSyncStartedAt', $data) && $data['lastSyncStartedAt'] !== null) {
            $object->setLastSyncStartedAt($data['lastSyncStartedAt']);
        }
        elseif (\array_key_exists('lastSyncStartedAt', $data) && $data['lastSyncStartedAt'] === null) {
            $object->setLastSyncStartedAt(null);
        }
        if (\array_key_exists('lastSyncSucceededAt', $data) && $data['lastSyncSucceededAt'] !== null) {
            $object->setLastSyncSucceededAt($data['lastSyncSucceededAt']);
        }
        elseif (\array_key_exists('lastSyncSucceededAt', $data) && $data['lastSyncSucceededAt'] === null) {
            $object->setLastSyncSucceededAt(null);
        }
        if (\array_key_exists('lastSyncErrorAt', $data) && $data['lastSyncErrorAt'] !== null) {
            $object->setLastSyncErrorAt($data['lastSyncErrorAt']);
        }
        elseif (\array_key_exists('lastSyncErrorAt', $data) && $data['lastSyncErrorAt'] === null) {
            $object->setLastSyncErrorAt(null);
        }
        if (\array_key_exists('lastSyncError', $data) && $data['lastSyncError'] !== null) {
            $object->setLastSyncError($data['lastSyncError']);
        }
        elseif (\array_key_exists('lastSyncError', $data) && $data['lastSyncError'] === null) {
            $object->setLastSyncError(null);
        }
        if (\array_key_exists('nextSyncAt', $data) && $data['nextSyncAt'] !== null) {
            $object->setNextSyncAt($data['nextSyncAt']);
        }
        elseif (\array_key_exists('nextSyncAt', $data) && $data['nextSyncAt'] === null) {
            $object->setNextSyncAt(null);
        }
        if (\array_key_exists('spendCap', $data) && $data['spendCap'] !== null) {
            $object->setSpendCap($this->denormalizer->denormalize($data['spendCap'], \Voidhash\Generated\Core\Model\AdAccountJsonEncodingSpendCap::class, 'json', $context));
        }
        elseif (\array_key_exists('spendCap', $data) && $data['spendCap'] === null) {
            $object->setSpendCap(null);
        }
        if (\array_key_exists('createdAt', $data)) {
            $object->setCreatedAt($data['createdAt']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['projectId'] = $data->getProjectId();
        $dataArray['platform'] = $data->getPlatform();
        $dataArray['externalId'] = $data->getExternalId();
        $dataArray['name'] = $data->getName();
        $dataArray['currency'] = $data->getCurrency();
        $dataArray['timezone'] = $data->getTimezone();
        $dataArray['backfillDays'] = $data->getBackfillDays();
        $dataArray['syncStatus'] = $data->getSyncStatus();
        $dataArray['lastSyncStartedAt'] = $data->getLastSyncStartedAt();
        $dataArray['lastSyncSucceededAt'] = $data->getLastSyncSucceededAt();
        $dataArray['lastSyncErrorAt'] = $data->getLastSyncErrorAt();
        $dataArray['lastSyncError'] = $data->getLastSyncError();
        $dataArray['nextSyncAt'] = $data->getNextSyncAt();
        $dataArray['spendCap'] = $this->normalizer->normalize($data->getSpendCap(), 'json', $context);
        $dataArray['createdAt'] = $data->getCreatedAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdAccountJsonEncoding::class => false];
    }
}