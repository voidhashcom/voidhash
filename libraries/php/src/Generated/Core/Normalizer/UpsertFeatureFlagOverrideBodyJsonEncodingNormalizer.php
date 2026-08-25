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
class UpsertFeatureFlagOverrideBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\UpsertFeatureFlagOverrideBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\UpsertFeatureFlagOverrideBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\UpsertFeatureFlagOverrideBodyJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('identityType', $data) && \is_int($data['identityType'])) {
            $data['identityType'] = (float) $data['identityType'];
        }
        if (\array_key_exists('forcedEnabled', $data) && \is_int($data['forcedEnabled'])) {
            $data['forcedEnabled'] = (bool) $data['forcedEnabled'];
        }
        if (\array_key_exists('featureFlagId', $data)) {
            $object->setFeatureFlagId($data['featureFlagId']);
        }
        if (\array_key_exists('forcedEnabled', $data) && $data['forcedEnabled'] !== null) {
            $object->setForcedEnabled($data['forcedEnabled']);
        }
        elseif (\array_key_exists('forcedEnabled', $data) && $data['forcedEnabled'] === null) {
            $object->setForcedEnabled(null);
        }
        if (\array_key_exists('forcedVariantKey', $data) && $data['forcedVariantKey'] !== null) {
            $object->setForcedVariantKey($data['forcedVariantKey']);
        }
        elseif (\array_key_exists('forcedVariantKey', $data) && $data['forcedVariantKey'] === null) {
            $object->setForcedVariantKey(null);
        }
        if (\array_key_exists('identityType', $data)) {
            $object->setIdentityType($data['identityType']);
        }
        if (\array_key_exists('identityValue', $data)) {
            $object->setIdentityValue($data['identityValue']);
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
        $dataArray['featureFlagId'] = $data->getFeatureFlagId();
        if ($data->isInitialized('forcedEnabled')) {
            $dataArray['forcedEnabled'] = $data->getForcedEnabled();
        }
        if ($data->isInitialized('forcedVariantKey')) {
            $dataArray['forcedVariantKey'] = $data->getForcedVariantKey();
        }
        $dataArray['identityType'] = $data->getIdentityType();
        $dataArray['identityValue'] = $data->getIdentityValue();
        if ($data->isInitialized('note')) {
            $dataArray['note'] = $data->getNote();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\UpsertFeatureFlagOverrideBodyJsonEncoding::class => false];
    }
}