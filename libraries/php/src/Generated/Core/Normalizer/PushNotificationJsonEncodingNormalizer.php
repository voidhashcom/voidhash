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
class PushNotificationJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PushNotificationJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PushNotificationJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PushNotificationJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isMessagePurged', $data) && \is_int($data['isMessagePurged'])) {
            $data['isMessagePurged'] = (bool) $data['isMessagePurged'];
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        if (\array_key_exists('message', $data)) {
            $values = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['message'] as $key => $value) {
                $values[$key] = $value;
            }
            $object->setMessage($values);
        }
        if (\array_key_exists('isMessagePurged', $data)) {
            $object->setIsMessagePurged($data['isMessagePurged']);
        }
        if (\array_key_exists('requestedPersonCount', $data)) {
            $object->setRequestedPersonCount($data['requestedPersonCount']);
        }
        if (\array_key_exists('requestedDistinctIdCount', $data)) {
            $object->setRequestedDistinctIdCount($data['requestedDistinctIdCount']);
        }
        if (\array_key_exists('unresolvedDistinctIds', $data)) {
            $values_1 = [];
            foreach ($data['unresolvedDistinctIds'] as $value_1) {
                $values_1[] = $value_1;
            }
            $object->setUnresolvedDistinctIds($values_1);
        }
        if (\array_key_exists('deviceCount', $data)) {
            $object->setDeviceCount($data['deviceCount']);
        }
        if (\array_key_exists('succeededCount', $data)) {
            $object->setSucceededCount($data['succeededCount']);
        }
        if (\array_key_exists('failedCount', $data)) {
            $object->setFailedCount($data['failedCount']);
        }
        if (\array_key_exists('skippedCount', $data)) {
            $object->setSkippedCount($data['skippedCount']);
        }
        if (\array_key_exists('idempotencyKey', $data) && $data['idempotencyKey'] !== null) {
            $object->setIdempotencyKey($data['idempotencyKey']);
        }
        elseif (\array_key_exists('idempotencyKey', $data) && $data['idempotencyKey'] === null) {
            $object->setIdempotencyKey(null);
        }
        if (\array_key_exists('createdAt', $data)) {
            $object->setCreatedAt($data['createdAt']);
        }
        if (\array_key_exists('completedAt', $data) && $data['completedAt'] !== null) {
            $object->setCompletedAt($data['completedAt']);
        }
        elseif (\array_key_exists('completedAt', $data) && $data['completedAt'] === null) {
            $object->setCompletedAt(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['status'] = $data->getStatus();
        $values = [];
        foreach ($data->getMessage() as $key => $value) {
            $values[$key] = $value;
        }
        $dataArray['message'] = $values;
        $dataArray['isMessagePurged'] = $data->getIsMessagePurged();
        $dataArray['requestedPersonCount'] = $data->getRequestedPersonCount();
        $dataArray['requestedDistinctIdCount'] = $data->getRequestedDistinctIdCount();
        $values_1 = [];
        foreach ($data->getUnresolvedDistinctIds() as $value_1) {
            $values_1[] = $value_1;
        }
        $dataArray['unresolvedDistinctIds'] = $values_1;
        $dataArray['deviceCount'] = $data->getDeviceCount();
        $dataArray['succeededCount'] = $data->getSucceededCount();
        $dataArray['failedCount'] = $data->getFailedCount();
        $dataArray['skippedCount'] = $data->getSkippedCount();
        $dataArray['idempotencyKey'] = $data->getIdempotencyKey();
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['completedAt'] = $data->getCompletedAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PushNotificationJsonEncoding::class => false];
    }
}