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
class NoticeCategoryPreferenceChangeJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\NoticeCategoryPreferenceChangeJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\NoticeCategoryPreferenceChangeJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\NoticeCategoryPreferenceChangeJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
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
        if (\array_key_exists('isInboxEnabled', $data) && $data['isInboxEnabled'] !== null) {
            $object->setIsInboxEnabled($data['isInboxEnabled']);
        }
        elseif (\array_key_exists('isInboxEnabled', $data) && $data['isInboxEnabled'] === null) {
            $object->setIsInboxEnabled(null);
        }
        if (\array_key_exists('isEmailEnabled', $data) && $data['isEmailEnabled'] !== null) {
            $object->setIsEmailEnabled($data['isEmailEnabled']);
        }
        elseif (\array_key_exists('isEmailEnabled', $data) && $data['isEmailEnabled'] === null) {
            $object->setIsEmailEnabled(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['category'] = $data->getCategory();
        if ($data->isInitialized('isInboxEnabled')) {
            $dataArray['isInboxEnabled'] = $data->getIsInboxEnabled();
        }
        if ($data->isInitialized('isEmailEnabled')) {
            $dataArray['isEmailEnabled'] = $data->getIsEmailEnabled();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\NoticeCategoryPreferenceChangeJsonEncoding::class => false];
    }
}