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
class ApiV1SdkSyncTransactionPostBodyNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\ApiV1SdkSyncTransactionPostBody::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\ApiV1SdkSyncTransactionPostBody::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\ApiV1SdkSyncTransactionPostBody();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('appAccountToken', $data) && $data['appAccountToken'] !== null) {
            $object->setAppAccountToken($data['appAccountToken']);
        }
        elseif (\array_key_exists('appAccountToken', $data) && $data['appAccountToken'] === null) {
            $object->setAppAccountToken(null);
        }
        if (\array_key_exists('platform', $data)) {
            $object->setPlatform($data['platform']);
        }
        if (\array_key_exists('providerProductId', $data) && $data['providerProductId'] !== null) {
            $object->setProviderProductId($data['providerProductId']);
        }
        elseif (\array_key_exists('providerProductId', $data) && $data['providerProductId'] === null) {
            $object->setProviderProductId(null);
        }
        if (\array_key_exists('productSlug', $data)) {
            $object->setProductSlug($data['productSlug']);
        }
        if (\array_key_exists('purchaseDate', $data)) {
            $object->setPurchaseDate($data['purchaseDate']);
        }
        if (\array_key_exists('purchaseToken', $data) && $data['purchaseToken'] !== null) {
            $object->setPurchaseToken($data['purchaseToken']);
        }
        elseif (\array_key_exists('purchaseToken', $data) && $data['purchaseToken'] === null) {
            $object->setPurchaseToken(null);
        }
        if (\array_key_exists('quantity', $data)) {
            $object->setQuantity($data['quantity']);
        }
        if (\array_key_exists('receipt', $data) && $data['receipt'] !== null) {
            $object->setReceipt($data['receipt']);
        }
        elseif (\array_key_exists('receipt', $data) && $data['receipt'] === null) {
            $object->setReceipt(null);
        }
        if (\array_key_exists('transactionId', $data)) {
            $object->setTransactionId($data['transactionId']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        if ($data->isInitialized('appAccountToken')) {
            $dataArray['appAccountToken'] = $data->getAppAccountToken();
        }
        $dataArray['platform'] = $data->getPlatform();
        if ($data->isInitialized('providerProductId')) {
            $dataArray['providerProductId'] = $data->getProviderProductId();
        }
        $dataArray['productSlug'] = $data->getProductSlug();
        $dataArray['purchaseDate'] = $data->getPurchaseDate();
        if ($data->isInitialized('purchaseToken')) {
            $dataArray['purchaseToken'] = $data->getPurchaseToken();
        }
        $dataArray['quantity'] = $data->getQuantity();
        if ($data->isInitialized('receipt')) {
            $dataArray['receipt'] = $data->getReceipt();
        }
        $dataArray['transactionId'] = $data->getTransactionId();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\ApiV1SdkSyncTransactionPostBody::class => false];
    }
}