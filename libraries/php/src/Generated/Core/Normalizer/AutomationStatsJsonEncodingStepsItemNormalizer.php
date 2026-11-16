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
class AutomationStatsJsonEncodingStepsItemNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AutomationStatsJsonEncodingStepsItem::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AutomationStatsJsonEncodingStepsItem::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AutomationStatsJsonEncodingStepsItem();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('stepId', $data)) {
            $object->setStepId($data['stepId']);
        }
        if (\array_key_exists('entered', $data)) {
            $object->setEntered($data['entered']);
        }
        if (\array_key_exists('completed', $data)) {
            $object->setCompleted($data['completed']);
        }
        if (\array_key_exists('failed', $data)) {
            $object->setFailed($data['failed']);
        }
        if (\array_key_exists('waiting', $data)) {
            $object->setWaiting($data['waiting']);
        }
        if (\array_key_exists('ports', $data)) {
            $values = [];
            foreach ($data['ports'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AutomationStatsJsonEncodingStepsItemPortsItem::class, 'json', $context);
            }
            $object->setPorts($values);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['stepId'] = $data->getStepId();
        $dataArray['entered'] = $data->getEntered();
        $dataArray['completed'] = $data->getCompleted();
        $dataArray['failed'] = $data->getFailed();
        $dataArray['waiting'] = $data->getWaiting();
        $values = [];
        foreach ($data->getPorts() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['ports'] = $values;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AutomationStatsJsonEncodingStepsItem::class => false];
    }
}