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
class UpsertFeatureFlagTargetBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\UpsertFeatureFlagTargetBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\UpsertFeatureFlagTargetBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\UpsertFeatureFlagTargetBodyJsonEncoding();
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
        if (\array_key_exists('listType', $data) && \is_int($data['listType'])) {
            $data['listType'] = (float) $data['listType'];
        }
        if (\array_key_exists('featureFlagId', $data)) {
            $object->setFeatureFlagId($data['featureFlagId']);
        }
        if (\array_key_exists('identityType', $data)) {
            $object->setIdentityType($data['identityType']);
        }
        if (\array_key_exists('identityValue', $data)) {
            $object->setIdentityValue($data['identityValue']);
        }
        if (\array_key_exists('listType', $data)) {
            $object->setListType($data['listType']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['featureFlagId'] = $data->getFeatureFlagId();
        $dataArray['identityType'] = $data->getIdentityType();
        $dataArray['identityValue'] = $data->getIdentityValue();
        $dataArray['listType'] = $data->getListType();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\UpsertFeatureFlagTargetBodyJsonEncoding::class => false];
    }
}