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
class AutomationCatalogJsonEncodingStepsItemNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AutomationCatalogJsonEncodingStepsItem::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AutomationCatalogJsonEncodingStepsItem::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AutomationCatalogJsonEncodingStepsItem();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('type', $data)) {
            $object->setType($data['type']);
        }
        if (\array_key_exists('kind', $data)) {
            $object->setKind($data['kind']);
        }
        if (\array_key_exists('label', $data)) {
            $object->setLabel($data['label']);
        }
        if (\array_key_exists('description', $data)) {
            $object->setDescription($data['description']);
        }
        if (\array_key_exists('fields', $data)) {
            $values = [];
            foreach ($data['fields'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AutomationField::class, 'json', $context);
            }
            $object->setFields($values);
        }
        if (\array_key_exists('ports', $data)) {
            $values_1 = [];
            foreach ($data['ports'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\AutomationCatalogJsonEncodingStepsItemPortsItem::class, 'json', $context);
            }
            $object->setPorts($values_1);
        }
        if (\array_key_exists('outputs', $data)) {
            $values_2 = [];
            foreach ($data['outputs'] as $value_2) {
                $values_2[] = $this->denormalizer->denormalize($value_2, \Voidhash\Generated\Core\Model\AutomationCatalogJsonEncodingStepsItemOutputsItem::class, 'json', $context);
            }
            $object->setOutputs($values_2);
        }
        if (\array_key_exists('permission', $data) && $data['permission'] !== null) {
            $object->setPermission($data['permission']);
        }
        elseif (\array_key_exists('permission', $data) && $data['permission'] === null) {
            $object->setPermission(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['type'] = $data->getType();
        $dataArray['kind'] = $data->getKind();
        $dataArray['label'] = $data->getLabel();
        $dataArray['description'] = $data->getDescription();
        $values = [];
        foreach ($data->getFields() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['fields'] = $values;
        $values_1 = [];
        foreach ($data->getPorts() as $value_1) {
            $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
        }
        $dataArray['ports'] = $values_1;
        $values_2 = [];
        foreach ($data->getOutputs() as $value_2) {
            $values_2[] = $this->normalizer->normalize($value_2, 'json', $context);
        }
        $dataArray['outputs'] = $values_2;
        $dataArray['permission'] = $data->getPermission();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AutomationCatalogJsonEncodingStepsItem::class => false];
    }
}