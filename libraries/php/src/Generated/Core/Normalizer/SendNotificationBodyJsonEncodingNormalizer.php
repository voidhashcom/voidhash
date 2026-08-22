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
class SendNotificationBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\SendNotificationBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\SendNotificationBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\SendNotificationBodyJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('personIds', $data) && $data['personIds'] !== null) {
            $values = [];
            foreach ($data['personIds'] as $value) {
                $values[] = $value;
            }
            $object->setPersonIds($values);
        }
        elseif (\array_key_exists('personIds', $data) && $data['personIds'] === null) {
            $object->setPersonIds(null);
        }
        if (\array_key_exists('distinctIds', $data) && $data['distinctIds'] !== null) {
            $values_1 = [];
            foreach ($data['distinctIds'] as $value_1) {
                $values_1[] = $value_1;
            }
            $object->setDistinctIds($values_1);
        }
        elseif (\array_key_exists('distinctIds', $data) && $data['distinctIds'] === null) {
            $object->setDistinctIds(null);
        }
        if (\array_key_exists('title', $data)) {
            $object->setTitle($data['title']);
        }
        if (\array_key_exists('body', $data)) {
            $object->setBody($data['body']);
        }
        if (\array_key_exists('data', $data) && $data['data'] !== null) {
            $values_2 = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['data'] as $key => $value_2) {
                $values_2[$key] = $value_2;
            }
            $object->setData($values_2);
        }
        elseif (\array_key_exists('data', $data) && $data['data'] === null) {
            $object->setData(null);
        }
        if (\array_key_exists('sound', $data) && $data['sound'] !== null) {
            $object->setSound($data['sound']);
        }
        elseif (\array_key_exists('sound', $data) && $data['sound'] === null) {
            $object->setSound(null);
        }
        if (\array_key_exists('badge', $data) && $data['badge'] !== null) {
            $object->setBadge($data['badge']);
        }
        elseif (\array_key_exists('badge', $data) && $data['badge'] === null) {
            $object->setBadge(null);
        }
        if (\array_key_exists('priority', $data) && $data['priority'] !== null) {
            $object->setPriority($data['priority']);
        }
        elseif (\array_key_exists('priority', $data) && $data['priority'] === null) {
            $object->setPriority(null);
        }
        if (\array_key_exists('ttl', $data) && $data['ttl'] !== null) {
            $object->setTtl($data['ttl']);
        }
        elseif (\array_key_exists('ttl', $data) && $data['ttl'] === null) {
            $object->setTtl(null);
        }
        if (\array_key_exists('channelId', $data) && $data['channelId'] !== null) {
            $object->setChannelId($data['channelId']);
        }
        elseif (\array_key_exists('channelId', $data) && $data['channelId'] === null) {
            $object->setChannelId(null);
        }
        if (\array_key_exists('collapseId', $data) && $data['collapseId'] !== null) {
            $object->setCollapseId($data['collapseId']);
        }
        elseif (\array_key_exists('collapseId', $data) && $data['collapseId'] === null) {
            $object->setCollapseId(null);
        }
        if (\array_key_exists('idempotencyKey', $data) && $data['idempotencyKey'] !== null) {
            $object->setIdempotencyKey($data['idempotencyKey']);
        }
        elseif (\array_key_exists('idempotencyKey', $data) && $data['idempotencyKey'] === null) {
            $object->setIdempotencyKey(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        if ($data->isInitialized('personIds')) {
            $values = [];
            foreach ($data->getPersonIds() as $value) {
                $values[] = $value;
            }
            $dataArray['personIds'] = $values;
        }
        if ($data->isInitialized('distinctIds')) {
            $values_1 = [];
            foreach ($data->getDistinctIds() as $value_1) {
                $values_1[] = $value_1;
            }
            $dataArray['distinctIds'] = $values_1;
        }
        $dataArray['title'] = $data->getTitle();
        $dataArray['body'] = $data->getBody();
        if ($data->isInitialized('data')) {
            $values_2 = [];
            foreach ($data->getData() as $key => $value_2) {
                $values_2[$key] = $value_2;
            }
            $dataArray['data'] = $values_2;
        }
        if ($data->isInitialized('sound')) {
            $dataArray['sound'] = $data->getSound();
        }
        if ($data->isInitialized('badge')) {
            $dataArray['badge'] = $data->getBadge();
        }
        if ($data->isInitialized('priority')) {
            $dataArray['priority'] = $data->getPriority();
        }
        if ($data->isInitialized('ttl')) {
            $dataArray['ttl'] = $data->getTtl();
        }
        if ($data->isInitialized('channelId')) {
            $dataArray['channelId'] = $data->getChannelId();
        }
        if ($data->isInitialized('collapseId')) {
            $dataArray['collapseId'] = $data->getCollapseId();
        }
        if ($data->isInitialized('idempotencyKey')) {
            $dataArray['idempotencyKey'] = $data->getIdempotencyKey();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\SendNotificationBodyJsonEncoding::class => false];
    }
}