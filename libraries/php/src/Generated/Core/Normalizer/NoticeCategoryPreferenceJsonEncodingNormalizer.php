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
class NoticeCategoryPreferenceJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\NoticeCategoryPreferenceJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\NoticeCategoryPreferenceJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\NoticeCategoryPreferenceJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isMandatory', $data) && \is_int($data['isMandatory'])) {
            $data['isMandatory'] = (bool) $data['isMandatory'];
        }
        if (\array_key_exists('isInboxEnabled', $data) && \is_int($data['isInboxEnabled'])) {
            $data['isInboxEnabled'] = (bool) $data['isInboxEnabled'];
        }
        if (\array_key_exists('isEmailEnabled', $data) && \is_int($data['isEmailEnabled'])) {
            $data['isEmailEnabled'] = (bool) $data['isEmailEnabled'];
        }
        if (\array_key_exists('category', $data)) {
            $object->setCategory($data['category']);
        }
        if (\array_key_exists('isMandatory', $data)) {
            $object->setIsMandatory($data['isMandatory']);
        }
        if (\array_key_exists('isInboxEnabled', $data)) {
            $object->setIsInboxEnabled($data['isInboxEnabled']);
        }
        if (\array_key_exists('isEmailEnabled', $data)) {
            $object->setIsEmailEnabled($data['isEmailEnabled']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['category'] = $data->getCategory();
        $dataArray['isMandatory'] = $data->getIsMandatory();
        $dataArray['isInboxEnabled'] = $data->getIsInboxEnabled();
        $dataArray['isEmailEnabled'] = $data->getIsEmailEnabled();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\NoticeCategoryPreferenceJsonEncoding::class => false];
    }
}