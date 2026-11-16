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
class AdsReportedMetricsNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AdsReportedMetrics::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AdsReportedMetrics::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AdsReportedMetrics();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('frequency', $data) && \is_int($data['frequency'])) {
            $data['frequency'] = (float) $data['frequency'];
        }
        if (\array_key_exists('ctr', $data) && \is_int($data['ctr'])) {
            $data['ctr'] = (float) $data['ctr'];
        }
        if (\array_key_exists('platformRoas', $data) && \is_int($data['platformRoas'])) {
            $data['platformRoas'] = (float) $data['platformRoas'];
        }
        if (\array_key_exists('spend', $data)) {
            $object->setSpend($data['spend']);
        }
        if (\array_key_exists('impressions', $data)) {
            $object->setImpressions($data['impressions']);
        }
        if (\array_key_exists('reach', $data) && $data['reach'] !== null) {
            $object->setReach($data['reach']);
        }
        elseif (\array_key_exists('reach', $data) && $data['reach'] === null) {
            $object->setReach(null);
        }
        if (\array_key_exists('frequency', $data) && $data['frequency'] !== null) {
            $object->setFrequency($data['frequency']);
        }
        elseif (\array_key_exists('frequency', $data) && $data['frequency'] === null) {
            $object->setFrequency(null);
        }
        if (\array_key_exists('linkClicks', $data)) {
            $object->setLinkClicks($data['linkClicks']);
        }
        if (\array_key_exists('ctr', $data) && $data['ctr'] !== null) {
            $object->setCtr($data['ctr']);
        }
        elseif (\array_key_exists('ctr', $data) && $data['ctr'] === null) {
            $object->setCtr(null);
        }
        if (\array_key_exists('purchaseValue', $data) && $data['purchaseValue'] !== null) {
            $object->setPurchaseValue($data['purchaseValue']);
        }
        elseif (\array_key_exists('purchaseValue', $data) && $data['purchaseValue'] === null) {
            $object->setPurchaseValue(null);
        }
        if (\array_key_exists('platformRoas', $data) && $data['platformRoas'] !== null) {
            $object->setPlatformRoas($data['platformRoas']);
        }
        elseif (\array_key_exists('platformRoas', $data) && $data['platformRoas'] === null) {
            $object->setPlatformRoas(null);
        }
        if (\array_key_exists('results', $data)) {
            $values = [];
            foreach ($data['results'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AdsReportedMetricsResultsItem::class, 'json', $context);
            }
            $object->setResults($values);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['spend'] = $data->getSpend();
        $dataArray['impressions'] = $data->getImpressions();
        $dataArray['reach'] = $data->getReach();
        $dataArray['frequency'] = $data->getFrequency();
        $dataArray['linkClicks'] = $data->getLinkClicks();
        $dataArray['ctr'] = $data->getCtr();
        $dataArray['purchaseValue'] = $data->getPurchaseValue();
        $dataArray['platformRoas'] = $data->getPlatformRoas();
        $values = [];
        foreach ($data->getResults() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['results'] = $values;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AdsReportedMetrics::class => false];
    }
}