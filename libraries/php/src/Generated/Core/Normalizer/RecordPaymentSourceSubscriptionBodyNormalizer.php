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
class RecordPaymentSourceSubscriptionBodyNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\RecordPaymentSourceSubscriptionBody::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\RecordPaymentSourceSubscriptionBody::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\RecordPaymentSourceSubscriptionBody();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isAutoRenewing', $data) && \is_int($data['isAutoRenewing'])) {
            $data['isAutoRenewing'] = (bool) $data['isAutoRenewing'];
        }
        if (\array_key_exists('distinctId', $data) && $data['distinctId'] !== null) {
            $object->setDistinctId($data['distinctId']);
        }
        elseif (\array_key_exists('distinctId', $data) && $data['distinctId'] === null) {
            $object->setDistinctId(null);
        }
        if (\array_key_exists('customer', $data)) {
            $object->setCustomer($this->denormalizer->denormalize($data['customer'], \Voidhash\Generated\Core\Model\PaymentSourceCustomer::class, 'json', $context));
        }
        if (\array_key_exists('productKey', $data)) {
            $object->setProductKey($data['productKey']);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        if (\array_key_exists('currentPeriodStart', $data)) {
            $object->setCurrentPeriodStart($data['currentPeriodStart']);
        }
        if (\array_key_exists('currentPeriodEnd', $data)) {
            $object->setCurrentPeriodEnd($data['currentPeriodEnd']);
        }
        if (\array_key_exists('isAutoRenewing', $data)) {
            $object->setIsAutoRenewing($data['isAutoRenewing']);
        }
        if (\array_key_exists('canceledAt', $data) && $data['canceledAt'] !== null) {
            $object->setCanceledAt($data['canceledAt']);
        }
        elseif (\array_key_exists('canceledAt', $data) && $data['canceledAt'] === null) {
            $object->setCanceledAt(null);
        }
        if (\array_key_exists('updatedAt', $data)) {
            $object->setUpdatedAt($data['updatedAt']);
        }
        if (\array_key_exists('environment', $data)) {
            $object->setEnvironment($data['environment']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        if ($data->isInitialized('distinctId')) {
            $dataArray['distinctId'] = $data->getDistinctId();
        }
        if ($data->isInitialized('customer') && null !== $data->getCustomer()) {
            $dataArray['customer'] = $this->normalizer->normalize($data->getCustomer(), 'json', $context);
        }
        $dataArray['productKey'] = $data->getProductKey();
        $dataArray['status'] = $data->getStatus();
        $dataArray['currentPeriodStart'] = $data->getCurrentPeriodStart();
        $dataArray['currentPeriodEnd'] = $data->getCurrentPeriodEnd();
        $dataArray['isAutoRenewing'] = $data->getIsAutoRenewing();
        if ($data->isInitialized('canceledAt')) {
            $dataArray['canceledAt'] = $data->getCanceledAt();
        }
        $dataArray['updatedAt'] = $data->getUpdatedAt();
        if ($data->isInitialized('environment') && null !== $data->getEnvironment()) {
            $dataArray['environment'] = $data->getEnvironment();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\RecordPaymentSourceSubscriptionBody::class => false];
    }
}