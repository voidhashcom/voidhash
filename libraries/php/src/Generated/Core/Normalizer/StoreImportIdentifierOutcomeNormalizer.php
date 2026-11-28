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
class StoreImportIdentifierOutcomeNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\StoreImportIdentifierOutcome::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\StoreImportIdentifierOutcome::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\StoreImportIdentifierOutcome();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('transactionId', $data) && $data['transactionId'] !== null) {
            $object->setTransactionId($data['transactionId']);
        }
        elseif (\array_key_exists('transactionId', $data) && $data['transactionId'] === null) {
            $object->setTransactionId(null);
        }
        if (\array_key_exists('purchaseToken', $data) && $data['purchaseToken'] !== null) {
            $object->setPurchaseToken($data['purchaseToken']);
        }
        elseif (\array_key_exists('purchaseToken', $data) && $data['purchaseToken'] === null) {
            $object->setPurchaseToken(null);
        }
        if (\array_key_exists('appUserId', $data) && $data['appUserId'] !== null) {
            $object->setAppUserId($data['appUserId']);
        }
        elseif (\array_key_exists('appUserId', $data) && $data['appUserId'] === null) {
            $object->setAppUserId(null);
        }
        if (\array_key_exists('outcome', $data)) {
            $object->setOutcome($data['outcome']);
        }
        if (\array_key_exists('note', $data) && $data['note'] !== null) {
            $object->setNote($data['note']);
        }
        elseif (\array_key_exists('note', $data) && $data['note'] === null) {
            $object->setNote(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['transactionId'] = $data->getTransactionId();
        $dataArray['purchaseToken'] = $data->getPurchaseToken();
        $dataArray['appUserId'] = $data->getAppUserId();
        $dataArray['outcome'] = $data->getOutcome();
        $dataArray['note'] = $data->getNote();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\StoreImportIdentifierOutcome::class => false];
    }
}