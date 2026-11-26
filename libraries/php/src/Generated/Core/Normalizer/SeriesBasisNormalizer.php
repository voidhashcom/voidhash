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
class SeriesBasisNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\SeriesBasis::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\SeriesBasis::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\SeriesBasis();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('metric', $data)) {
            $object->setMetric($data['metric']);
        }
        if (\array_key_exists('event', $data)) {
            $object->setEvent($data['event']);
        }
        if (\array_key_exists('aggregation', $data)) {
            $object->setAggregation($data['aggregation']);
        }
        if (\array_key_exists('statistic', $data)) {
            $object->setStatistic($data['statistic']);
        }
        if (\array_key_exists('property', $data)) {
            $object->setProperty($data['property']);
        }
        if (\array_key_exists('groupType', $data)) {
            $object->setGroupType($data['groupType']);
        }
        if (\array_key_exists('basis', $data)) {
            $object->setBasis($data['basis']);
        }
        if (\array_key_exists('filters', $data)) {
            $values = [];
            foreach ($data['filters'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\ExploreFilter::class, 'json', $context);
            }
            $object->setFilters($values);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['metric'] = $data->getMetric();
        if ($data->isInitialized('event') && null !== $data->getEvent()) {
            $dataArray['event'] = $data->getEvent();
        }
        if ($data->isInitialized('aggregation') && null !== $data->getAggregation()) {
            $dataArray['aggregation'] = $data->getAggregation();
        }
        if ($data->isInitialized('statistic') && null !== $data->getStatistic()) {
            $dataArray['statistic'] = $data->getStatistic();
        }
        if ($data->isInitialized('property') && null !== $data->getProperty()) {
            $dataArray['property'] = $data->getProperty();
        }
        if ($data->isInitialized('groupType') && null !== $data->getGroupType()) {
            $dataArray['groupType'] = $data->getGroupType();
        }
        if ($data->isInitialized('basis') && null !== $data->getBasis()) {
            $dataArray['basis'] = $data->getBasis();
        }
        if ($data->isInitialized('filters') && null !== $data->getFilters()) {
            $values = [];
            foreach ($data->getFilters() as $value) {
                $values[] = $this->normalizer->normalize($value, 'json', $context);
            }
            $dataArray['filters'] = $values;
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\SeriesBasis::class => false];
    }
}