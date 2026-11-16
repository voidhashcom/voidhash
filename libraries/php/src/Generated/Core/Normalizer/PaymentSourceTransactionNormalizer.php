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
class PaymentSourceTransactionNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PaymentSourceTransaction::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PaymentSourceTransaction::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PaymentSourceTransaction();
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
        if (\array_key_exists('paymentProviderId', $data)) {
            $object->setPaymentProviderId($data['paymentProviderId']);
        }
        if (\array_key_exists('type', $data)) {
            $object->setType($data['type']);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        if (\array_key_exists('pendingReason', $data) && $data['pendingReason'] !== null) {
            $object->setPendingReason($data['pendingReason']);
        }
        elseif (\array_key_exists('pendingReason', $data) && $data['pendingReason'] === null) {
            $object->setPendingReason(null);
        }
        if (\array_key_exists('purchaseId', $data) && $data['purchaseId'] !== null) {
            $object->setPurchaseId($data['purchaseId']);
        }
        elseif (\array_key_exists('purchaseId', $data) && $data['purchaseId'] === null) {
            $object->setPurchaseId(null);
        }
        if (\array_key_exists('bookedAmount', $data) && $data['bookedAmount'] !== null) {
            $object->setBookedAmount($data['bookedAmount']);
        }
        elseif (\array_key_exists('bookedAmount', $data) && $data['bookedAmount'] === null) {
            $object->setBookedAmount(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['paymentProviderId'] = $data->getPaymentProviderId();
        $dataArray['type'] = $data->getType();
        $dataArray['status'] = $data->getStatus();
        $dataArray['pendingReason'] = $data->getPendingReason();
        $dataArray['purchaseId'] = $data->getPurchaseId();
        $dataArray['bookedAmount'] = $data->getBookedAmount();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PaymentSourceTransaction::class => false];
    }
}