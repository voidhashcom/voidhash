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
class InsightInputNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\InsightInput::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\InsightInput::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\InsightInput();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('compare', $data) && \is_int($data['compare'])) {
            $data['compare'] = (bool) $data['compare'];
        }
        if (\array_key_exists('markers', $data) && \is_int($data['markers'])) {
            $data['markers'] = (bool) $data['markers'];
        }
        if (\array_key_exists('kind', $data)) {
            $object->setKind($data['kind']);
        }
        if (\array_key_exists('series', $data)) {
            $values = [];
            foreach ($data['series'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\InsightInputSeriesItem::class, 'json', $context);
            }
            $object->setSeries($values);
        }
        if (\array_key_exists('display', $data)) {
            $object->setDisplay($data['display']);
        }
        if (\array_key_exists('range', $data)) {
            $object->setRange($data['range']);
        }
        if (\array_key_exists('compare', $data)) {
            $object->setCompare($data['compare']);
        }
        if (\array_key_exists('comparison', $data)) {
            $object->setComparison($data['comparison']);
        }
        if (\array_key_exists('comparisonRange', $data)) {
            $object->setComparisonRange($data['comparisonRange']);
        }
        if (\array_key_exists('granularity', $data)) {
            $object->setGranularity($data['granularity']);
        }
        if (\array_key_exists('markers', $data)) {
            $object->setMarkers($data['markers']);
        }
        if (\array_key_exists('filters', $data)) {
            $values_1 = [];
            foreach ($data['filters'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\ExploreFilter::class, 'json', $context);
            }
            $object->setFilters($values_1);
        }
        if (\array_key_exists('split', $data)) {
            $value_2 = $data['split'];
            if (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'store')) {
                $value_2 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\ExploreStoreDimension::class, 'json', $context);
            } elseif (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'product')) {
                $value_2 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\ExploreProductDimension::class, 'json', $context);
            } elseif (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'billing_period')) {
                $value_2 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\ExploreBillingPeriodDimension::class, 'json', $context);
            } elseif (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'plan')) {
                $value_2 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\ExplorePlanDimension::class, 'json', $context);
            } elseif (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'trait') and \array_key_exists('key', $data['split'])) {
                $value_2 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\ExploreTraitDimension::class, 'json', $context);
            } elseif (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'property') and \array_key_exists('key', $data['split'])) {
                $value_2 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\ExplorePropertyDimension::class, 'json', $context);
            } elseif (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'cohort')) {
                $value_2 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\ExploreCohortDimension::class, 'json', $context);
            } elseif (is_array($data['split']) and (\array_key_exists('kind', $data['split']) and $data['split']['kind'] == 'group') and \array_key_exists('groupType', $data['split'])) {
                $value_2 = $this->denormalizer->denormalize($data['split'], \Voidhash\Generated\Core\Model\ExploreGroupDimension::class, 'json', $context);
            }
            $object->setSplit($value_2);
        }
        if (\array_key_exists('actor', $data)) {
            $object->setActor($data['actor']);
        }
        if (\array_key_exists('funnel', $data)) {
            $object->setFunnel($this->denormalizer->denormalize($data['funnel'], \Voidhash\Generated\Core\Model\InsightInputFunnel::class, 'json', $context));
        }
        if (\array_key_exists('retention', $data)) {
            $object->setRetention($this->denormalizer->denormalize($data['retention'], \Voidhash\Generated\Core\Model\InsightInputRetention::class, 'json', $context));
        }
        if (\array_key_exists('paths', $data)) {
            $object->setPaths($this->denormalizer->denormalize($data['paths'], \Voidhash\Generated\Core\Model\InsightInputPaths::class, 'json', $context));
        }
        if (\array_key_exists('stickiness', $data)) {
            $object->setStickiness($this->denormalizer->denormalize($data['stickiness'], \Voidhash\Generated\Core\Model\InsightInputStickiness::class, 'json', $context));
        }
        if (\array_key_exists('lifecycle', $data)) {
            $object->setLifecycle($this->denormalizer->denormalize($data['lifecycle'], \Voidhash\Generated\Core\Model\InsightInputLifecycle::class, 'json', $context));
        }
        if (\array_key_exists('trend', $data)) {
            $object->setTrend($this->denormalizer->denormalize($data['trend'], \Voidhash\Generated\Core\Model\InsightInputTrend::class, 'json', $context));
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        if ($data->isInitialized('kind') && null !== $data->getKind()) {
            $dataArray['kind'] = $data->getKind();
        }
        $values = [];
        foreach ($data->getSeries() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['series'] = $values;
        if ($data->isInitialized('display') && null !== $data->getDisplay()) {
            $dataArray['display'] = $data->getDisplay();
        }
        if ($data->isInitialized('range') && null !== $data->getRange()) {
            $dataArray['range'] = $data->getRange();
        }
        if ($data->isInitialized('compare') && null !== $data->getCompare()) {
            $dataArray['compare'] = $data->getCompare();
        }
        if ($data->isInitialized('comparison') && null !== $data->getComparison()) {
            $dataArray['comparison'] = $data->getComparison();
        }
        if ($data->isInitialized('comparisonRange') && null !== $data->getComparisonRange()) {
            $dataArray['comparisonRange'] = $data->getComparisonRange();
        }
        if ($data->isInitialized('granularity') && null !== $data->getGranularity()) {
            $dataArray['granularity'] = $data->getGranularity();
        }
        if ($data->isInitialized('markers') && null !== $data->getMarkers()) {
            $dataArray['markers'] = $data->getMarkers();
        }
        if ($data->isInitialized('filters') && null !== $data->getFilters()) {
            $values_1 = [];
            foreach ($data->getFilters() as $value_1) {
                $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
            }
            $dataArray['filters'] = $values_1;
        }
        if ($data->isInitialized('split') && null !== $data->getSplit()) {
            $value_2 = $data->getSplit();
            if (is_object($data->getSplit())) {
                $value_2 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            } elseif (is_object($data->getSplit())) {
                $value_2 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            } elseif (is_object($data->getSplit())) {
                $value_2 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            } elseif (is_object($data->getSplit())) {
                $value_2 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            } elseif (is_object($data->getSplit())) {
                $value_2 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            } elseif (is_object($data->getSplit())) {
                $value_2 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            } elseif (is_object($data->getSplit())) {
                $value_2 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            } elseif (is_object($data->getSplit())) {
                $value_2 = $this->normalizer->normalize($data->getSplit(), 'json', $context);
            }
            $dataArray['split'] = $value_2;
        }
        if ($data->isInitialized('actor') && null !== $data->getActor()) {
            $dataArray['actor'] = $data->getActor();
        }
        if ($data->isInitialized('funnel') && null !== $data->getFunnel()) {
            $dataArray['funnel'] = $this->normalizer->normalize($data->getFunnel(), 'json', $context);
        }
        if ($data->isInitialized('retention') && null !== $data->getRetention()) {
            $dataArray['retention'] = $this->normalizer->normalize($data->getRetention(), 'json', $context);
        }
        if ($data->isInitialized('paths') && null !== $data->getPaths()) {
            $dataArray['paths'] = $this->normalizer->normalize($data->getPaths(), 'json', $context);
        }
        if ($data->isInitialized('stickiness') && null !== $data->getStickiness()) {
            $dataArray['stickiness'] = $this->normalizer->normalize($data->getStickiness(), 'json', $context);
        }
        if ($data->isInitialized('lifecycle') && null !== $data->getLifecycle()) {
            $dataArray['lifecycle'] = $this->normalizer->normalize($data->getLifecycle(), 'json', $context);
        }
        if ($data->isInitialized('trend') && null !== $data->getTrend()) {
            $dataArray['trend'] = $this->normalizer->normalize($data->getTrend(), 'json', $context);
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\InsightInput::class => false];
    }
}