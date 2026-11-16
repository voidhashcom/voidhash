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
class PersonSubscriptionJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PersonSubscriptionJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PersonSubscriptionJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PersonSubscriptionJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isCancelingAtPeriodEnd', $data) && \is_int($data['isCancelingAtPeriodEnd'])) {
            $data['isCancelingAtPeriodEnd'] = (bool) $data['isCancelingAtPeriodEnd'];
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('productName', $data)) {
            $object->setProductName($data['productName']);
        }
        if (\array_key_exists('environment', $data)) {
            $object->setEnvironment($data['environment']);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        if (\array_key_exists('startsAt', $data)) {
            $object->setStartsAt($data['startsAt']);
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
        if (\array_key_exists('isCancelingAtPeriodEnd', $data)) {
            $object->setIsCancelingAtPeriodEnd($data['isCancelingAtPeriodEnd']);
        }
        if (\array_key_exists('paymentSource', $data)) {
            $object->setPaymentSource($this->denormalizer->denormalize($data['paymentSource'], \Voidhash\Generated\Core\Model\PersonPurchasePaymentSource::class, 'json', $context));
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['productName'] = $data->getProductName();
        $dataArray['environment'] = $data->getEnvironment();
        $dataArray['status'] = $data->getStatus();
        $dataArray['startsAt'] = $data->getStartsAt();
        $dataArray['expiresAt'] = $data->getExpiresAt();
        $dataArray['gracePeriodExpiresAt'] = $data->getGracePeriodExpiresAt();
        $dataArray['isCancelingAtPeriodEnd'] = $data->getIsCancelingAtPeriodEnd();
        $dataArray['paymentSource'] = $this->normalizer->normalize($data->getPaymentSource(), 'json', $context);
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PersonSubscriptionJsonEncoding::class => false];
    }
}