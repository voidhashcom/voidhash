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
class AcquisitionCohortsResultJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AcquisitionCohortsResultJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AcquisitionCohortsResultJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AcquisitionCohortsResultJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('projectId', $data)) {
            $object->setProjectId($data['projectId']);
        }
        if (\array_key_exists('groupBy', $data)) {
            $object->setGroupBy($data['groupBy']);
        }
        if (\array_key_exists('currency', $data)) {
            $object->setCurrency($data['currency']);
        }
        if (\array_key_exists('timezone', $data)) {
            $object->setTimezone($data['timezone']);
        }
        if (\array_key_exists('environment', $data)) {
            $object->setEnvironment($data['environment']);
        }
        if (\array_key_exists('attributionWindowDays', $data)) {
            $object->setAttributionWindowDays($data['attributionWindowDays']);
        }
        if (\array_key_exists('from', $data)) {
            $object->setFrom($data['from']);
        }
        if (\array_key_exists('to', $data)) {
            $object->setTo($data['to']);
        }
        if (\array_key_exists('start', $data)) {
            $object->setStart($data['start']);
        }
        if (\array_key_exists('end', $data)) {
            $object->setEnd($data['end']);
        }
        if (\array_key_exists('asOf', $data)) {
            $object->setAsOf($data['asOf']);
        }
        if (\array_key_exists('days', $data)) {
            $values = [];
            foreach ($data['days'] as $value) {
                $values[] = $value;
            }
            $object->setDays($values);
        }
        if (\array_key_exists('groups', $data)) {
            $values_1 = [];
            foreach ($data['groups'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\AcquisitionCohortsResultJsonEncodingGroupsItem::class, 'json', $context);
            }
            $object->setGroups($values_1);
        }
        if (\array_key_exists('total', $data)) {
            $values_2 = [];
            foreach ($data['total'] as $value_2) {
                $values_2[] = $this->denormalizer->denormalize($value_2, \Voidhash\Generated\Core\Model\AcquisitionCohort::class, 'json', $context);
            }
            $object->setTotal($values_2);
        }
        if (\array_key_exists('projection', $data)) {
            $object->setProjection($this->denormalizer->denormalize($data['projection'], \Voidhash\Generated\Core\Model\AcquisitionProjectionModel::class, 'json', $context));
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['projectId'] = $data->getProjectId();
        $dataArray['groupBy'] = $data->getGroupBy();
        $dataArray['currency'] = $data->getCurrency();
        $dataArray['timezone'] = $data->getTimezone();
        $dataArray['environment'] = $data->getEnvironment();
        $dataArray['attributionWindowDays'] = $data->getAttributionWindowDays();
        $dataArray['from'] = $data->getFrom();
        $dataArray['to'] = $data->getTo();
        $dataArray['start'] = $data->getStart();
        $dataArray['end'] = $data->getEnd();
        $dataArray['asOf'] = $data->getAsOf();
        $values = [];
        foreach ($data->getDays() as $value) {
            $values[] = $value;
        }
        $dataArray['days'] = $values;
        $values_1 = [];
        foreach ($data->getGroups() as $value_1) {
            $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
        }
        $dataArray['groups'] = $values_1;
        $values_2 = [];
        foreach ($data->getTotal() as $value_2) {
            $values_2[] = $this->normalizer->normalize($value_2, 'json', $context);
        }
        $dataArray['total'] = $values_2;
        $dataArray['projection'] = $this->normalizer->normalize($data->getProjection(), 'json', $context);
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AcquisitionCohortsResultJsonEncoding::class => false];
    }
}