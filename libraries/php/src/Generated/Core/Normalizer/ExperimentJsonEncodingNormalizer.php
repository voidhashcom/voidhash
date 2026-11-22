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
class ExperimentJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\ExperimentJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\ExperimentJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\ExperimentJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isArchived', $data) && \is_int($data['isArchived'])) {
            $data['isArchived'] = (bool) $data['isArchived'];
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('projectId', $data)) {
            $object->setProjectId($data['projectId']);
        }
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('description', $data) && $data['description'] !== null) {
            $object->setDescription($data['description']);
        }
        elseif (\array_key_exists('description', $data) && $data['description'] === null) {
            $object->setDescription(null);
        }
        if (\array_key_exists('hypothesis', $data) && $data['hypothesis'] !== null) {
            $object->setHypothesis($data['hypothesis']);
        }
        elseif (\array_key_exists('hypothesis', $data) && $data['hypothesis'] === null) {
            $object->setHypothesis(null);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        if (\array_key_exists('primaryMetricEventName', $data) && $data['primaryMetricEventName'] !== null) {
            $object->setPrimaryMetricEventName($data['primaryMetricEventName']);
        }
        elseif (\array_key_exists('primaryMetricEventName', $data) && $data['primaryMetricEventName'] === null) {
            $object->setPrimaryMetricEventName(null);
        }
        if (\array_key_exists('secondaryMetricEventNames', $data)) {
            $values = [];
            foreach ($data['secondaryMetricEventNames'] as $value) {
                $values[] = $value;
            }
            $object->setSecondaryMetricEventNames($values);
        }
        if (\array_key_exists('paywallLocationIds', $data)) {
            $values_1 = [];
            foreach ($data['paywallLocationIds'] as $value_1) {
                $values_1[] = $value_1;
            }
            $object->setPaywallLocationIds($values_1);
        }
        if (\array_key_exists('testedFeatureFlagIds', $data)) {
            $values_2 = [];
            foreach ($data['testedFeatureFlagIds'] as $value_2) {
                $values_2[] = $value_2;
            }
            $object->setTestedFeatureFlagIds($values_2);
        }
        if (\array_key_exists('winningVariantId', $data) && $data['winningVariantId'] !== null) {
            $object->setWinningVariantId($data['winningVariantId']);
        }
        elseif (\array_key_exists('winningVariantId', $data) && $data['winningVariantId'] === null) {
            $object->setWinningVariantId(null);
        }
        if (\array_key_exists('rolloutDifferences', $data)) {
            $values_3 = [];
            foreach ($data['rolloutDifferences'] as $value_3) {
                $values_3[] = $this->denormalizer->denormalize($value_3, \Voidhash\Generated\Core\Model\ExperimentRolloutDifference::class, 'json', $context);
            }
            $object->setRolloutDifferences($values_3);
        }
        if (\array_key_exists('featureFlagId', $data)) {
            $object->setFeatureFlagId($data['featureFlagId']);
        }
        if (\array_key_exists('isArchived', $data)) {
            $object->setIsArchived($data['isArchived']);
        }
        if (\array_key_exists('startedAt', $data) && $data['startedAt'] !== null) {
            $object->setStartedAt($data['startedAt']);
        }
        elseif (\array_key_exists('startedAt', $data) && $data['startedAt'] === null) {
            $object->setStartedAt(null);
        }
        if (\array_key_exists('endedAt', $data) && $data['endedAt'] !== null) {
            $object->setEndedAt($data['endedAt']);
        }
        elseif (\array_key_exists('endedAt', $data) && $data['endedAt'] === null) {
            $object->setEndedAt(null);
        }
        if (\array_key_exists('createdAt', $data) && $data['createdAt'] !== null) {
            $object->setCreatedAt($data['createdAt']);
        }
        elseif (\array_key_exists('createdAt', $data) && $data['createdAt'] === null) {
            $object->setCreatedAt(null);
        }
        if (\array_key_exists('updatedAt', $data) && $data['updatedAt'] !== null) {
            $object->setUpdatedAt($data['updatedAt']);
        }
        elseif (\array_key_exists('updatedAt', $data) && $data['updatedAt'] === null) {
            $object->setUpdatedAt(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['projectId'] = $data->getProjectId();
        $dataArray['name'] = $data->getName();
        $dataArray['description'] = $data->getDescription();
        $dataArray['hypothesis'] = $data->getHypothesis();
        $dataArray['status'] = $data->getStatus();
        $dataArray['primaryMetricEventName'] = $data->getPrimaryMetricEventName();
        $values = [];
        foreach ($data->getSecondaryMetricEventNames() as $value) {
            $values[] = $value;
        }
        $dataArray['secondaryMetricEventNames'] = $values;
        $values_1 = [];
        foreach ($data->getPaywallLocationIds() as $value_1) {
            $values_1[] = $value_1;
        }
        $dataArray['paywallLocationIds'] = $values_1;
        $values_2 = [];
        foreach ($data->getTestedFeatureFlagIds() as $value_2) {
            $values_2[] = $value_2;
        }
        $dataArray['testedFeatureFlagIds'] = $values_2;
        $dataArray['winningVariantId'] = $data->getWinningVariantId();
        $values_3 = [];
        foreach ($data->getRolloutDifferences() as $value_3) {
            $values_3[] = $this->normalizer->normalize($value_3, 'json', $context);
        }
        $dataArray['rolloutDifferences'] = $values_3;
        $dataArray['featureFlagId'] = $data->getFeatureFlagId();
        $dataArray['isArchived'] = $data->getIsArchived();
        $dataArray['startedAt'] = $data->getStartedAt();
        $dataArray['endedAt'] = $data->getEndedAt();
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['updatedAt'] = $data->getUpdatedAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\ExperimentJsonEncoding::class => false];
    }
}