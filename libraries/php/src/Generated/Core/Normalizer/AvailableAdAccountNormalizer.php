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
class AvailableAdAccountNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AvailableAdAccount::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AvailableAdAccount::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AvailableAdAccount();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isSuggested', $data) && \is_int($data['isSuggested'])) {
            $data['isSuggested'] = (bool) $data['isSuggested'];
        }
        if (\array_key_exists('isConnected', $data) && \is_int($data['isConnected'])) {
            $data['isConnected'] = (bool) $data['isConnected'];
        }
        if (\array_key_exists('externalId', $data)) {
            $object->setExternalId($data['externalId']);
        }
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('currency', $data)) {
            $object->setCurrency($data['currency']);
        }
        if (\array_key_exists('timezone', $data)) {
            $object->setTimezone($data['timezone']);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        if (\array_key_exists('inactiveReason', $data) && $data['inactiveReason'] !== null) {
            $object->setInactiveReason($data['inactiveReason']);
        }
        elseif (\array_key_exists('inactiveReason', $data) && $data['inactiveReason'] === null) {
            $object->setInactiveReason(null);
        }
        if (\array_key_exists('amountSpent', $data)) {
            $object->setAmountSpent($data['amountSpent']);
        }
        if (\array_key_exists('isSuggested', $data)) {
            $object->setIsSuggested($data['isSuggested']);
        }
        if (\array_key_exists('isConnected', $data)) {
            $object->setIsConnected($data['isConnected']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['externalId'] = $data->getExternalId();
        $dataArray['name'] = $data->getName();
        $dataArray['currency'] = $data->getCurrency();
        $dataArray['timezone'] = $data->getTimezone();
        $dataArray['status'] = $data->getStatus();
        $dataArray['inactiveReason'] = $data->getInactiveReason();
        $dataArray['amountSpent'] = $data->getAmountSpent();
        $dataArray['isSuggested'] = $data->getIsSuggested();
        $dataArray['isConnected'] = $data->getIsConnected();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AvailableAdAccount::class => false];
    }
}