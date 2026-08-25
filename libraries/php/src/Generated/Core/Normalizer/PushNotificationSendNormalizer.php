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
class PushNotificationSendNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PushNotificationSend::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PushNotificationSend::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PushNotificationSend();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('messagePurged', $data) && \is_int($data['messagePurged'])) {
            $data['messagePurged'] = (bool) $data['messagePurged'];
        }
        if (\array_key_exists('completedAt', $data) && $data['completedAt'] !== null) {
            $object->setCompletedAt($data['completedAt']);
        }
        elseif (\array_key_exists('completedAt', $data) && $data['completedAt'] === null) {
            $object->setCompletedAt(null);
        }
        if (\array_key_exists('createdAt', $data)) {
            $object->setCreatedAt($data['createdAt']);
        }
        if (\array_key_exists('deviceCount', $data)) {
            $object->setDeviceCount($data['deviceCount']);
        }
        if (\array_key_exists('failedCount', $data)) {
            $object->setFailedCount($data['failedCount']);
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('idempotencyKey', $data) && $data['idempotencyKey'] !== null) {
            $object->setIdempotencyKey($data['idempotencyKey']);
        }
        elseif (\array_key_exists('idempotencyKey', $data) && $data['idempotencyKey'] === null) {
            $object->setIdempotencyKey(null);
        }
        if (\array_key_exists('message', $data)) {
            $values = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['message'] as $key => $value) {
                $values[$key] = $value;
            }
            $object->setMessage($values);
        }
        if (\array_key_exists('messagePurged', $data)) {
            $object->setMessagePurged($data['messagePurged']);
        }
        if (\array_key_exists('requestedDistinctIdCount', $data)) {
            $object->setRequestedDistinctIdCount($data['requestedDistinctIdCount']);
        }
        if (\array_key_exists('requestedPersonCount', $data)) {
            $object->setRequestedPersonCount($data['requestedPersonCount']);
        }
        if (\array_key_exists('skippedCount', $data)) {
            $object->setSkippedCount($data['skippedCount']);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        if (\array_key_exists('succeededCount', $data)) {
            $object->setSucceededCount($data['succeededCount']);
        }
        if (\array_key_exists('unresolvedDistinctIds', $data)) {
            $values_1 = [];
            foreach ($data['unresolvedDistinctIds'] as $value_1) {
                $values_1[] = $value_1;
            }
            $object->setUnresolvedDistinctIds($values_1);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['completedAt'] = $data->getCompletedAt();
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['deviceCount'] = $data->getDeviceCount();
        $dataArray['failedCount'] = $data->getFailedCount();
        $dataArray['id'] = $data->getId();
        $dataArray['idempotencyKey'] = $data->getIdempotencyKey();
        $values = [];
        foreach ($data->getMessage() as $key => $value) {
            $values[$key] = $value;
        }
        $dataArray['message'] = $values;
        $dataArray['messagePurged'] = $data->getMessagePurged();
        $dataArray['requestedDistinctIdCount'] = $data->getRequestedDistinctIdCount();
        $dataArray['requestedPersonCount'] = $data->getRequestedPersonCount();
        $dataArray['skippedCount'] = $data->getSkippedCount();
        $dataArray['status'] = $data->getStatus();
        $dataArray['succeededCount'] = $data->getSucceededCount();
        $values_1 = [];
        foreach ($data->getUnresolvedDistinctIds() as $value_1) {
            $values_1[] = $value_1;
        }
        $dataArray['unresolvedDistinctIds'] = $values_1;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PushNotificationSend::class => false];
    }
}