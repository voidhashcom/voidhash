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
class RecordPaymentSourceTransactionBodyNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\RecordPaymentSourceTransactionBody::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\RecordPaymentSourceTransactionBody::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\RecordPaymentSourceTransactionBody();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('type', $data)) {
            $object->setType($data['type']);
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
        if (\array_key_exists('productKey', $data) && $data['productKey'] !== null) {
            $object->setProductKey($data['productKey']);
        }
        elseif (\array_key_exists('productKey', $data) && $data['productKey'] === null) {
            $object->setProductKey(null);
        }
        if (\array_key_exists('amount', $data)) {
            $object->setAmount($data['amount']);
        }
        if (\array_key_exists('currency', $data)) {
            $object->setCurrency($data['currency']);
        }
        if (\array_key_exists('fee', $data) && $data['fee'] !== null) {
            $object->setFee($data['fee']);
        }
        elseif (\array_key_exists('fee', $data) && $data['fee'] === null) {
            $object->setFee(null);
        }
        if (\array_key_exists('tax', $data) && $data['tax'] !== null) {
            $object->setTax($data['tax']);
        }
        elseif (\array_key_exists('tax', $data) && $data['tax'] === null) {
            $object->setTax(null);
        }
        if (\array_key_exists('occurredAt', $data)) {
            $object->setOccurredAt($data['occurredAt']);
        }
        if (\array_key_exists('subscriptionId', $data) && $data['subscriptionId'] !== null) {
            $object->setSubscriptionId($data['subscriptionId']);
        }
        elseif (\array_key_exists('subscriptionId', $data) && $data['subscriptionId'] === null) {
            $object->setSubscriptionId(null);
        }
        if (\array_key_exists('periodStart', $data) && $data['periodStart'] !== null) {
            $object->setPeriodStart($data['periodStart']);
        }
        elseif (\array_key_exists('periodStart', $data) && $data['periodStart'] === null) {
            $object->setPeriodStart(null);
        }
        if (\array_key_exists('periodEnd', $data) && $data['periodEnd'] !== null) {
            $object->setPeriodEnd($data['periodEnd']);
        }
        elseif (\array_key_exists('periodEnd', $data) && $data['periodEnd'] === null) {
            $object->setPeriodEnd(null);
        }
        if (\array_key_exists('refundsTransactionId', $data) && $data['refundsTransactionId'] !== null) {
            $object->setRefundsTransactionId($data['refundsTransactionId']);
        }
        elseif (\array_key_exists('refundsTransactionId', $data) && $data['refundsTransactionId'] === null) {
            $object->setRefundsTransactionId(null);
        }
        if (\array_key_exists('environment', $data)) {
            $object->setEnvironment($data['environment']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['type'] = $data->getType();
        if ($data->isInitialized('distinctId')) {
            $dataArray['distinctId'] = $data->getDistinctId();
        }
        if ($data->isInitialized('customer') && null !== $data->getCustomer()) {
            $dataArray['customer'] = $this->normalizer->normalize($data->getCustomer(), 'json', $context);
        }
        if ($data->isInitialized('productKey')) {
            $dataArray['productKey'] = $data->getProductKey();
        }
        $dataArray['amount'] = $data->getAmount();
        $dataArray['currency'] = $data->getCurrency();
        if ($data->isInitialized('fee')) {
            $dataArray['fee'] = $data->getFee();
        }
        if ($data->isInitialized('tax')) {
            $dataArray['tax'] = $data->getTax();
        }
        $dataArray['occurredAt'] = $data->getOccurredAt();
        if ($data->isInitialized('subscriptionId')) {
            $dataArray['subscriptionId'] = $data->getSubscriptionId();
        }
        if ($data->isInitialized('periodStart')) {
            $dataArray['periodStart'] = $data->getPeriodStart();
        }
        if ($data->isInitialized('periodEnd')) {
            $dataArray['periodEnd'] = $data->getPeriodEnd();
        }
        if ($data->isInitialized('refundsTransactionId')) {
            $dataArray['refundsTransactionId'] = $data->getRefundsTransactionId();
        }
        if ($data->isInitialized('environment') && null !== $data->getEnvironment()) {
            $dataArray['environment'] = $data->getEnvironment();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\RecordPaymentSourceTransactionBody::class => false];
    }
}