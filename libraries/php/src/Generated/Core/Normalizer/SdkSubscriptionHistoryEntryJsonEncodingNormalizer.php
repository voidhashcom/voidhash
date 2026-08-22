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
class SdkSubscriptionHistoryEntryJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\SdkSubscriptionHistoryEntryJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\SdkSubscriptionHistoryEntryJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\SdkSubscriptionHistoryEntryJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isTrial', $data) && \is_int($data['isTrial'])) {
            $data['isTrial'] = (bool) $data['isTrial'];
        }
        if (\array_key_exists('canceledAt', $data) && $data['canceledAt'] !== null) {
            $object->setCanceledAt($data['canceledAt']);
        }
        elseif (\array_key_exists('canceledAt', $data) && $data['canceledAt'] === null) {
            $object->setCanceledAt(null);
        }
        if (\array_key_exists('expiresAt', $data) && $data['expiresAt'] !== null) {
            $object->setExpiresAt($data['expiresAt']);
        }
        elseif (\array_key_exists('expiresAt', $data) && $data['expiresAt'] === null) {
            $object->setExpiresAt(null);
        }
        if (\array_key_exists('isTrial', $data)) {
            $object->setIsTrial($data['isTrial']);
        }
        if (\array_key_exists('productId', $data) && $data['productId'] !== null) {
            $object->setProductId($data['productId']);
        }
        elseif (\array_key_exists('productId', $data) && $data['productId'] === null) {
            $object->setProductId(null);
        }
        if (\array_key_exists('sourcePersonId', $data)) {
            $object->setSourcePersonId($data['sourcePersonId']);
        }
        if (\array_key_exists('startsAt', $data)) {
            $object->setStartsAt($data['startsAt']);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        if (\array_key_exists('subscriptionId', $data)) {
            $object->setSubscriptionId($data['subscriptionId']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['canceledAt'] = $data->getCanceledAt();
        $dataArray['expiresAt'] = $data->getExpiresAt();
        $dataArray['isTrial'] = $data->getIsTrial();
        $dataArray['productId'] = $data->getProductId();
        $dataArray['sourcePersonId'] = $data->getSourcePersonId();
        $dataArray['startsAt'] = $data->getStartsAt();
        $dataArray['status'] = $data->getStatus();
        $dataArray['subscriptionId'] = $data->getSubscriptionId();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\SdkSubscriptionHistoryEntryJsonEncoding::class => false];
    }
}