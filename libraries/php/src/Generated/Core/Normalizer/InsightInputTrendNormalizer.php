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
class InsightInputTrendNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\InsightInputTrend::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\InsightInputTrend::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\InsightInputTrend();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('cumulative', $data) && \is_int($data['cumulative'])) {
            $data['cumulative'] = (bool) $data['cumulative'];
        }
        if (\array_key_exists('logScale', $data) && \is_int($data['logScale'])) {
            $data['logScale'] = (bool) $data['logScale'];
        }
        if (\array_key_exists('showValues', $data) && \is_int($data['showValues'])) {
            $data['showValues'] = (bool) $data['showValues'];
        }
        if (\array_key_exists('percentStack', $data) && \is_int($data['percentStack'])) {
            $data['percentStack'] = (bool) $data['percentStack'];
        }
        if (\array_key_exists('formula', $data)) {
            $object->setFormula($data['formula']);
        }
        if (\array_key_exists('cumulative', $data)) {
            $object->setCumulative($data['cumulative']);
        }
        if (\array_key_exists('smoothing', $data)) {
            $object->setSmoothing($data['smoothing']);
        }
        if (\array_key_exists('chart', $data)) {
            $object->setChart($data['chart']);
        }
        if (\array_key_exists('logScale', $data)) {
            $object->setLogScale($data['logScale']);
        }
        if (\array_key_exists('showValues', $data)) {
            $object->setShowValues($data['showValues']);
        }
        if (\array_key_exists('percentStack', $data)) {
            $object->setPercentStack($data['percentStack']);
        }
        if (\array_key_exists('goals', $data)) {
            $values = [];
            foreach ($data['goals'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\InsightInputTrendGoalsItem::class, 'json', $context);
            }
            $object->setGoals($values);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        if ($data->isInitialized('formula') && null !== $data->getFormula()) {
            $dataArray['formula'] = $data->getFormula();
        }
        if ($data->isInitialized('cumulative') && null !== $data->getCumulative()) {
            $dataArray['cumulative'] = $data->getCumulative();
        }
        if ($data->isInitialized('smoothing') && null !== $data->getSmoothing()) {
            $dataArray['smoothing'] = $data->getSmoothing();
        }
        if ($data->isInitialized('chart') && null !== $data->getChart()) {
            $dataArray['chart'] = $data->getChart();
        }
        if ($data->isInitialized('logScale') && null !== $data->getLogScale()) {
            $dataArray['logScale'] = $data->getLogScale();
        }
        if ($data->isInitialized('showValues') && null !== $data->getShowValues()) {
            $dataArray['showValues'] = $data->getShowValues();
        }
        if ($data->isInitialized('percentStack') && null !== $data->getPercentStack()) {
            $dataArray['percentStack'] = $data->getPercentStack();
        }
        if ($data->isInitialized('goals') && null !== $data->getGoals()) {
            $values = [];
            foreach ($data->getGoals() as $value) {
                $values[] = $this->normalizer->normalize($value, 'json', $context);
            }
            $dataArray['goals'] = $values;
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\InsightInputTrend::class => false];
    }
}