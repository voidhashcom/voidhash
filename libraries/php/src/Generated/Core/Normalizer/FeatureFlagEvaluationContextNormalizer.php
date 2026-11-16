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
class FeatureFlagEvaluationContextNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\FeatureFlagEvaluationContext::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\FeatureFlagEvaluationContext::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\FeatureFlagEvaluationContext();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('platform', $data) && $data['platform'] !== null) {
            $object->setPlatform($data['platform']);
        }
        elseif (\array_key_exists('platform', $data) && $data['platform'] === null) {
            $object->setPlatform(null);
        }
        if (\array_key_exists('appVersion', $data) && $data['appVersion'] !== null) {
            $object->setAppVersion($data['appVersion']);
        }
        elseif (\array_key_exists('appVersion', $data) && $data['appVersion'] === null) {
            $object->setAppVersion(null);
        }
        if (\array_key_exists('osVersion', $data) && $data['osVersion'] !== null) {
            $object->setOsVersion($data['osVersion']);
        }
        elseif (\array_key_exists('osVersion', $data) && $data['osVersion'] === null) {
            $object->setOsVersion(null);
        }
        if (\array_key_exists('country', $data) && $data['country'] !== null) {
            $object->setCountry($data['country']);
        }
        elseif (\array_key_exists('country', $data) && $data['country'] === null) {
            $object->setCountry(null);
        }
        if (\array_key_exists('locale', $data) && $data['locale'] !== null) {
            $object->setLocale($data['locale']);
        }
        elseif (\array_key_exists('locale', $data) && $data['locale'] === null) {
            $object->setLocale(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        if ($data->isInitialized('platform')) {
            $dataArray['platform'] = $data->getPlatform();
        }
        if ($data->isInitialized('appVersion')) {
            $dataArray['appVersion'] = $data->getAppVersion();
        }
        if ($data->isInitialized('osVersion')) {
            $dataArray['osVersion'] = $data->getOsVersion();
        }
        if ($data->isInitialized('country')) {
            $dataArray['country'] = $data->getCountry();
        }
        if ($data->isInitialized('locale')) {
            $dataArray['locale'] = $data->getLocale();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\FeatureFlagEvaluationContext::class => false];
    }
}