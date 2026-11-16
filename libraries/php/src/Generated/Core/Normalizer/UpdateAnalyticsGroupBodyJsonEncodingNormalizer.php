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
class UpdateAnalyticsGroupBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\UpdateAnalyticsGroupBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\UpdateAnalyticsGroupBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\UpdateAnalyticsGroupBodyJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('set', $data)) {
            $values = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['set'] as $key => $value) {
                $values[$key] = $value;
            }
            $object->setSet($values);
        }
        if (\array_key_exists('setOnce', $data)) {
            $values_1 = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['setOnce'] as $key_1 => $value_1) {
                $values_1[$key_1] = $value_1;
            }
            $object->setSetOnce($values_1);
        }
        if (\array_key_exists('unset', $data) && $data['unset'] !== null) {
            $values_2 = [];
            foreach ($data['unset'] as $value_2) {
                $values_2[] = $value_2;
            }
            $object->setUnset($values_2);
        }
        elseif (\array_key_exists('unset', $data) && $data['unset'] === null) {
            $object->setUnset(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        if ($data->isInitialized('set') && null !== $data->getSet()) {
            $values = [];
            foreach ($data->getSet() as $key => $value) {
                $values[$key] = $value;
            }
            $dataArray['set'] = $values;
        }
        if ($data->isInitialized('setOnce') && null !== $data->getSetOnce()) {
            $values_1 = [];
            foreach ($data->getSetOnce() as $key_1 => $value_1) {
                $values_1[$key_1] = $value_1;
            }
            $dataArray['setOnce'] = $values_1;
        }
        if ($data->isInitialized('unset')) {
            $values_2 = [];
            foreach ($data->getUnset() as $value_2) {
                $values_2[] = $value_2;
            }
            $dataArray['unset'] = $values_2;
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\UpdateAnalyticsGroupBodyJsonEncoding::class => false];
    }
}