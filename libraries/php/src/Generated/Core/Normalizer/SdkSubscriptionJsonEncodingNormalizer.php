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
class SdkSubscriptionJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\SdkSubscriptionJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\SdkSubscriptionJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\SdkSubscriptionJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isFamilyShared', $data) && \is_int($data['isFamilyShared'])) {
            $data['isFamilyShared'] = (bool) $data['isFamilyShared'];
        }
        if (\array_key_exists('willRenew', $data) && \is_int($data['willRenew'])) {
            $data['willRenew'] = (bool) $data['willRenew'];
        }
        if (\array_key_exists('billingIssueDetectedAt', $data) && $data['billingIssueDetectedAt'] !== null) {
            $object->setBillingIssueDetectedAt($data['billingIssueDetectedAt']);
        }
        elseif (\array_key_exists('billingIssueDetectedAt', $data) && $data['billingIssueDetectedAt'] === null) {
            $object->setBillingIssueDetectedAt(null);
        }
        if (\array_key_exists('canceledAt', $data) && $data['canceledAt'] !== null) {
            $object->setCanceledAt($data['canceledAt']);
        }
        elseif (\array_key_exists('canceledAt', $data) && $data['canceledAt'] === null) {
            $object->setCanceledAt(null);
        }
        if (\array_key_exists('environment', $data)) {
            $object->setEnvironment($data['environment']);
        }
        if (\array_key_exists('expiresAt', $data) && $data['expiresAt'] !== null) {
            $object->setExpiresAt($data['expiresAt']);
        }
        elseif (\array_key_exists('expiresAt', $data) && $data['expiresAt'] === null) {
            $object->setExpiresAt(null);
        }
        if (\array_key_exists('gracePeriodExpiresAt', $data) && $data['gracePeriodExpiresAt'] !== null) {
            $object->setGracePeriodExpiresAt($data['gracePeriodExpiresAt']);
        }
        elseif (\array_key_exists('gracePeriodExpiresAt', $data) && $data['gracePeriodExpiresAt'] === null) {
            $object->setGracePeriodExpiresAt(null);
        }
        if (\array_key_exists('isFamilyShared', $data)) {
            $object->setIsFamilyShared($data['isFamilyShared']);
        }
        if (\array_key_exists('offerId', $data) && $data['offerId'] !== null) {
            $object->setOfferId($data['offerId']);
        }
        elseif (\array_key_exists('offerId', $data) && $data['offerId'] === null) {
            $object->setOfferId(null);
        }
        if (\array_key_exists('pendingPrice', $data)) {
            $object->setPendingPrice($this->denormalizer->denormalize($data['pendingPrice'], \Voidhash\Generated\Core\Model\SdkSubscriptionPendingPriceJsonEncoding::class, 'json', $context));
        }
        if (\array_key_exists('periodType', $data)) {
            $object->setPeriodType($data['periodType']);
        }
        if (\array_key_exists('productId', $data) && $data['productId'] !== null) {
            $object->setProductId($data['productId']);
        }
        elseif (\array_key_exists('productId', $data) && $data['productId'] === null) {
            $object->setProductId(null);
        }
        if (\array_key_exists('productSlug', $data) && $data['productSlug'] !== null) {
            $object->setProductSlug($data['productSlug']);
        }
        elseif (\array_key_exists('productSlug', $data) && $data['productSlug'] === null) {
            $object->setProductSlug(null);
        }
        if (\array_key_exists('refundedAt', $data) && $data['refundedAt'] !== null) {
            $object->setRefundedAt($data['refundedAt']);
        }
        elseif (\array_key_exists('refundedAt', $data) && $data['refundedAt'] === null) {
            $object->setRefundedAt(null);
        }
        if (\array_key_exists('renewsToProductSlug', $data) && $data['renewsToProductSlug'] !== null) {
            $object->setRenewsToProductSlug($data['renewsToProductSlug']);
        }
        elseif (\array_key_exists('renewsToProductSlug', $data) && $data['renewsToProductSlug'] === null) {
            $object->setRenewsToProductSlug(null);
        }
        if (\array_key_exists('resumesAt', $data) && $data['resumesAt'] !== null) {
            $object->setResumesAt($data['resumesAt']);
        }
        elseif (\array_key_exists('resumesAt', $data) && $data['resumesAt'] === null) {
            $object->setResumesAt(null);
        }
        if (\array_key_exists('revokedAt', $data) && $data['revokedAt'] !== null) {
            $object->setRevokedAt($data['revokedAt']);
        }
        elseif (\array_key_exists('revokedAt', $data) && $data['revokedAt'] === null) {
            $object->setRevokedAt(null);
        }
        if (\array_key_exists('startsAt', $data)) {
            $object->setStartsAt($data['startsAt']);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        if (\array_key_exists('store', $data)) {
            $object->setStore($data['store']);
        }
        if (\array_key_exists('subscriptionId', $data)) {
            $object->setSubscriptionId($data['subscriptionId']);
        }
        if (\array_key_exists('willRenew', $data)) {
            $object->setWillRenew($data['willRenew']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['billingIssueDetectedAt'] = $data->getBillingIssueDetectedAt();
        $dataArray['canceledAt'] = $data->getCanceledAt();
        $dataArray['environment'] = $data->getEnvironment();
        $dataArray['expiresAt'] = $data->getExpiresAt();
        $dataArray['gracePeriodExpiresAt'] = $data->getGracePeriodExpiresAt();
        $dataArray['isFamilyShared'] = $data->getIsFamilyShared();
        $dataArray['offerId'] = $data->getOfferId();
        $dataArray['pendingPrice'] = $this->normalizer->normalize($data->getPendingPrice(), 'json', $context);
        $dataArray['periodType'] = $data->getPeriodType();
        $dataArray['productId'] = $data->getProductId();
        $dataArray['productSlug'] = $data->getProductSlug();
        $dataArray['refundedAt'] = $data->getRefundedAt();
        $dataArray['renewsToProductSlug'] = $data->getRenewsToProductSlug();
        $dataArray['resumesAt'] = $data->getResumesAt();
        $dataArray['revokedAt'] = $data->getRevokedAt();
        $dataArray['startsAt'] = $data->getStartsAt();
        $dataArray['status'] = $data->getStatus();
        $dataArray['store'] = $data->getStore();
        $dataArray['subscriptionId'] = $data->getSubscriptionId();
        $dataArray['willRenew'] = $data->getWillRenew();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\SdkSubscriptionJsonEncoding::class => false];
    }
}