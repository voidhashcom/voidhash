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
class DevelopmentStatePurchasesItemNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\DevelopmentStatePurchasesItem::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\DevelopmentStatePurchasesItem::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\DevelopmentStatePurchasesItem();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('createdAt', $data) && $data['createdAt'] !== null) {
            $object->setCreatedAt($data['createdAt']);
        }
        elseif (\array_key_exists('createdAt', $data) && $data['createdAt'] === null) {
            $object->setCreatedAt(null);
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('productId', $data)) {
            $object->setProductId($data['productId']);
        }
        if (\array_key_exists('productName', $data)) {
            $object->setProductName($data['productName']);
        }
        if (\array_key_exists('productSlug', $data)) {
            $object->setProductSlug($data['productSlug']);
        }
        if (\array_key_exists('refundedAt', $data) && $data['refundedAt'] !== null) {
            $object->setRefundedAt($data['refundedAt']);
        }
        elseif (\array_key_exists('refundedAt', $data) && $data['refundedAt'] === null) {
            $object->setRefundedAt(null);
        }
        if (\array_key_exists('revokedAt', $data) && $data['revokedAt'] !== null) {
            $object->setRevokedAt($data['revokedAt']);
        }
        elseif (\array_key_exists('revokedAt', $data) && $data['revokedAt'] === null) {
            $object->setRevokedAt(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['id'] = $data->getId();
        $dataArray['productId'] = $data->getProductId();
        $dataArray['productName'] = $data->getProductName();
        $dataArray['productSlug'] = $data->getProductSlug();
        $dataArray['refundedAt'] = $data->getRefundedAt();
        $dataArray['revokedAt'] = $data->getRevokedAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\DevelopmentStatePurchasesItem::class => false];
    }
}