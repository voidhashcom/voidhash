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
class AdsCohortsReportJsonEncodingCohortsItemNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncodingCohortsItem::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncodingCohortsItem::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncodingCohortsItem();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('start', $data)) {
            $object->setStart($data['start']);
        }
        if (\array_key_exists('spend', $data)) {
            $object->setSpend($data['spend']);
        }
        if (\array_key_exists('people', $data)) {
            $object->setPeople($data['people']);
        }
        if (\array_key_exists('values', $data)) {
            $values = [];
            foreach ($data['values'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncodingCohortsItemValuesItem::class, 'json', $context);
            }
            $object->setValues($values);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['start'] = $data->getStart();
        $dataArray['spend'] = $data->getSpend();
        $dataArray['people'] = $data->getPeople();
        $values = [];
        foreach ($data->getValues() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['values'] = $values;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncodingCohortsItem::class => false];
    }
}