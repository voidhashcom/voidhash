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
class FeatureFlagEnvironmentJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\FeatureFlagEnvironmentJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\FeatureFlagEnvironmentJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\FeatureFlagEnvironmentJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isEnabled', $data) && \is_int($data['isEnabled'])) {
            $data['isEnabled'] = (bool) $data['isEnabled'];
        }
        if (\array_key_exists('isEnabled', $data)) {
            $object->setIsEnabled($data['isEnabled']);
        }
        if (\array_key_exists('overrides', $data)) {
            $values = [];
            foreach ($data['overrides'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\FeatureFlagEnvironmentOverrideJsonEncoding::class, 'json', $context);
            }
            $object->setOverrides($values);
        }
        if (\array_key_exists('rules', $data)) {
            $values_1 = [];
            foreach ($data['rules'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\FeatureFlagRuleJsonEncoding::class, 'json', $context);
            }
            $object->setRules($values_1);
        }
        if (\array_key_exists('fallthrough', $data)) {
            $object->setFallthrough($this->denormalizer->denormalize($data['fallthrough'], \Voidhash\Generated\Core\Model\FeatureFlagServeJsonEncoding::class, 'json', $context));
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['isEnabled'] = $data->getIsEnabled();
        $values = [];
        foreach ($data->getOverrides() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['overrides'] = $values;
        $values_1 = [];
        foreach ($data->getRules() as $value_1) {
            $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
        }
        $dataArray['rules'] = $values_1;
        $dataArray['fallthrough'] = $this->normalizer->normalize($data->getFallthrough(), 'json', $context);
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\FeatureFlagEnvironmentJsonEncoding::class => false];
    }
}