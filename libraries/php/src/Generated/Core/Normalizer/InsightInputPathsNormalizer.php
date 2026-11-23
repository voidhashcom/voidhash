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
class InsightInputPathsNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\InsightInputPaths::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\InsightInputPaths::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\InsightInputPaths();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('collapseRepeated', $data) && \is_int($data['collapseRepeated'])) {
            $data['collapseRepeated'] = (bool) $data['collapseRepeated'];
        }
        if (\array_key_exists('start', $data)) {
            $object->setStart($data['start']);
        }
        if (\array_key_exists('end', $data)) {
            $object->setEnd($data['end']);
        }
        if (\array_key_exists('exclude', $data)) {
            $values = [];
            foreach ($data['exclude'] as $value) {
                $values[] = $value;
            }
            $object->setExclude($values);
        }
        if (\array_key_exists('depth', $data)) {
            $object->setDepth($data['depth']);
        }
        if (\array_key_exists('item', $data)) {
            $object->setItem($data['item']);
        }
        if (\array_key_exists('collapseRepeated', $data)) {
            $object->setCollapseRepeated($data['collapseRepeated']);
        }
        if (\array_key_exists('edgeLimit', $data)) {
            $object->setEdgeLimit($data['edgeLimit']);
        }
        if (\array_key_exists('minEdgeCount', $data)) {
            $object->setMinEdgeCount($data['minEdgeCount']);
        }
        if (\array_key_exists('maxEdgeCount', $data)) {
            $object->setMaxEdgeCount($data['maxEdgeCount']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        if ($data->isInitialized('start') && null !== $data->getStart()) {
            $dataArray['start'] = $data->getStart();
        }
        if ($data->isInitialized('end') && null !== $data->getEnd()) {
            $dataArray['end'] = $data->getEnd();
        }
        if ($data->isInitialized('exclude') && null !== $data->getExclude()) {
            $values = [];
            foreach ($data->getExclude() as $value) {
                $values[] = $value;
            }
            $dataArray['exclude'] = $values;
        }
        if ($data->isInitialized('depth') && null !== $data->getDepth()) {
            $dataArray['depth'] = $data->getDepth();
        }
        if ($data->isInitialized('item') && null !== $data->getItem()) {
            $dataArray['item'] = $data->getItem();
        }
        if ($data->isInitialized('collapseRepeated') && null !== $data->getCollapseRepeated()) {
            $dataArray['collapseRepeated'] = $data->getCollapseRepeated();
        }
        if ($data->isInitialized('edgeLimit') && null !== $data->getEdgeLimit()) {
            $dataArray['edgeLimit'] = $data->getEdgeLimit();
        }
        if ($data->isInitialized('minEdgeCount') && null !== $data->getMinEdgeCount()) {
            $dataArray['minEdgeCount'] = $data->getMinEdgeCount();
        }
        if ($data->isInitialized('maxEdgeCount') && null !== $data->getMaxEdgeCount()) {
            $dataArray['maxEdgeCount'] = $data->getMaxEdgeCount();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\InsightInputPaths::class => false];
    }
}