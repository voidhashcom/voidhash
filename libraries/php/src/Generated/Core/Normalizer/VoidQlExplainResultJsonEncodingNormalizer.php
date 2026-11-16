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
class VoidQlExplainResultJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\VoidQlExplainResultJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\VoidQlExplainResultJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\VoidQlExplainResultJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('hasPersonalData', $data) && \is_int($data['hasPersonalData'])) {
            $data['hasPersonalData'] = (bool) $data['hasPersonalData'];
        }
        if (\array_key_exists('columns', $data)) {
            $values = [];
            foreach ($data['columns'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\VoidQlExplainResultJsonEncodingColumnsItem::class, 'json', $context);
            }
            $object->setColumns($values);
        }
        if (\array_key_exists('relations', $data)) {
            $values_1 = [];
            foreach ($data['relations'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\VoidQlExplainResultJsonEncodingRelationsItem::class, 'json', $context);
            }
            $object->setRelations($values_1);
        }
        if (\array_key_exists('projectIds', $data)) {
            $values_2 = [];
            foreach ($data['projectIds'] as $value_2) {
                $values_2[] = $value_2;
            }
            $object->setProjectIds($values_2);
        }
        if (\array_key_exists('hasPersonalData', $data)) {
            $object->setHasPersonalData($data['hasPersonalData']);
        }
        if (\array_key_exists('estimate', $data) && $data['estimate'] !== null) {
            $object->setEstimate($this->denormalizer->denormalize($data['estimate'], \Voidhash\Generated\Core\Model\VoidQlExplainResultJsonEncodingEstimate::class, 'json', $context));
        }
        elseif (\array_key_exists('estimate', $data) && $data['estimate'] === null) {
            $object->setEstimate(null);
        }
        if (\array_key_exists('limits', $data)) {
            $object->setLimits($this->denormalizer->denormalize($data['limits'], \Voidhash\Generated\Core\Model\VoidQlExplainResultJsonEncodingLimits::class, 'json', $context));
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $values = [];
        foreach ($data->getColumns() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['columns'] = $values;
        $values_1 = [];
        foreach ($data->getRelations() as $value_1) {
            $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
        }
        $dataArray['relations'] = $values_1;
        $values_2 = [];
        foreach ($data->getProjectIds() as $value_2) {
            $values_2[] = $value_2;
        }
        $dataArray['projectIds'] = $values_2;
        $dataArray['hasPersonalData'] = $data->getHasPersonalData();
        $dataArray['estimate'] = $this->normalizer->normalize($data->getEstimate(), 'json', $context);
        $dataArray['limits'] = $this->normalizer->normalize($data->getLimits(), 'json', $context);
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\VoidQlExplainResultJsonEncoding::class => false];
    }
}