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
class AdsCohortsReportJsonEncodingGroupsItemNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncodingGroupsItem::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncodingGroupsItem::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncodingGroupsItem();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('paybackProbability', $data) && \is_int($data['paybackProbability'])) {
            $data['paybackProbability'] = (float) $data['paybackProbability'];
        }
        if (\array_key_exists('key', $data)) {
            $object->setKey($data['key']);
        }
        if (\array_key_exists('name', $data) && $data['name'] !== null) {
            $object->setName($data['name']);
        }
        elseif (\array_key_exists('name', $data) && $data['name'] === null) {
            $object->setName(null);
        }
        if (\array_key_exists('surface', $data) && $data['surface'] !== null) {
            $object->setSurface($data['surface']);
        }
        elseif (\array_key_exists('surface', $data) && $data['surface'] === null) {
            $object->setSurface(null);
        }
        if (\array_key_exists('people', $data)) {
            $object->setPeople($data['people']);
        }
        if (\array_key_exists('values', $data)) {
            $values = [];
            foreach ($data['values'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AdsCohortValue::class, 'json', $context);
            }
            $object->setValues($values);
        }
        if (\array_key_exists('paybackDay', $data) && $data['paybackDay'] !== null) {
            $object->setPaybackDay($data['paybackDay']);
        }
        elseif (\array_key_exists('paybackDay', $data) && $data['paybackDay'] === null) {
            $object->setPaybackDay(null);
        }
        if (\array_key_exists('paybackProbability', $data) && $data['paybackProbability'] !== null) {
            $object->setPaybackProbability($data['paybackProbability']);
        }
        elseif (\array_key_exists('paybackProbability', $data) && $data['paybackProbability'] === null) {
            $object->setPaybackProbability(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['key'] = $data->getKey();
        $dataArray['name'] = $data->getName();
        $dataArray['surface'] = $data->getSurface();
        $dataArray['people'] = $data->getPeople();
        $values = [];
        foreach ($data->getValues() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['values'] = $values;
        $dataArray['paybackDay'] = $data->getPaybackDay();
        $dataArray['paybackProbability'] = $data->getPaybackProbability();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdsCohortsReportJsonEncodingGroupsItem::class => false];
    }
}