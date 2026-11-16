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
class AnalyticsChartHistogramResultNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AnalyticsChartHistogramResult::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AnalyticsChartHistogramResult::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AnalyticsChartHistogramResult();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('median', $data) && \is_int($data['median'])) {
            $data['median'] = (float) $data['median'];
        }
        if (\array_key_exists('total', $data) && \is_int($data['total'])) {
            $data['total'] = (float) $data['total'];
        }
        if (\array_key_exists('shape', $data)) {
            $object->setShape($data['shape']);
        }
        if (\array_key_exists('unit', $data)) {
            $object->setUnit($data['unit']);
        }
        if (\array_key_exists('bins', $data)) {
            $values = [];
            foreach ($data['bins'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AnalyticsChartHistogramResultBinsItem::class, 'json', $context);
            }
            $object->setBins($values);
        }
        if (\array_key_exists('median', $data) && $data['median'] !== null) {
            $object->setMedian($data['median']);
        }
        elseif (\array_key_exists('median', $data) && $data['median'] === null) {
            $object->setMedian(null);
        }
        if (\array_key_exists('total', $data)) {
            $object->setTotal($data['total']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['shape'] = $data->getShape();
        $dataArray['unit'] = $data->getUnit();
        $values = [];
        foreach ($data->getBins() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['bins'] = $values;
        $dataArray['median'] = $data->getMedian();
        $dataArray['total'] = $data->getTotal();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AnalyticsChartHistogramResult::class => false];
    }
}