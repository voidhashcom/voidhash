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
class AdsCreativeRowCopyNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdsCreativeRowCopy::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdsCreativeRowCopy::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdsCreativeRowCopy();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('primaryTexts', $data)) {
            $values = [];
            foreach ($data['primaryTexts'] as $value) {
                $values[] = $value;
            }
            $object->setPrimaryTexts($values);
        }
        if (\array_key_exists('headlines', $data)) {
            $values_1 = [];
            foreach ($data['headlines'] as $value_1) {
                $values_1[] = $value_1;
            }
            $object->setHeadlines($values_1);
        }
        if (\array_key_exists('descriptions', $data)) {
            $values_2 = [];
            foreach ($data['descriptions'] as $value_2) {
                $values_2[] = $value_2;
            }
            $object->setDescriptions($values_2);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $values = [];
        foreach ($data->getPrimaryTexts() as $value) {
            $values[] = $value;
        }
        $dataArray['primaryTexts'] = $values;
        $values_1 = [];
        foreach ($data->getHeadlines() as $value_1) {
            $values_1[] = $value_1;
        }
        $dataArray['headlines'] = $values_1;
        $values_2 = [];
        foreach ($data->getDescriptions() as $value_2) {
            $values_2[] = $value_2;
        }
        $dataArray['descriptions'] = $values_2;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdsCreativeRowCopy::class => false];
    }
}