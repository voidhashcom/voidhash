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
class ExperimentJsonEncoding1Normalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\ExperimentJsonEncoding1::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\ExperimentJsonEncoding1::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\ExperimentJsonEncoding1();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('archivedAt', $data) && $data['archivedAt'] !== null) {
            $object->setArchivedAt($data['archivedAt']);
        }
        elseif (\array_key_exists('archivedAt', $data) && $data['archivedAt'] === null) {
            $object->setArchivedAt(null);
        }
        if (\array_key_exists('backingFlag', $data)) {
            $object->setBackingFlag($this->denormalizer->denormalize($data['backingFlag'], \Voidhash\Generated\Core\Model\ExperimentBackingFlagJsonEncoding::class, 'json', $context));
        }
        if (\array_key_exists('createdAt', $data) && $data['createdAt'] !== null) {
            $object->setCreatedAt($data['createdAt']);
        }
        elseif (\array_key_exists('createdAt', $data) && $data['createdAt'] === null) {
            $object->setCreatedAt(null);
        }
        if (\array_key_exists('createdByUserId', $data) && $data['createdByUserId'] !== null) {
            $object->setCreatedByUserId($data['createdByUserId']);
        }
        elseif (\array_key_exists('createdByUserId', $data) && $data['createdByUserId'] === null) {
            $object->setCreatedByUserId(null);
        }
        if (\array_key_exists('description', $data) && $data['description'] !== null) {
            $object->setDescription($data['description']);
        }
        elseif (\array_key_exists('description', $data) && $data['description'] === null) {
            $object->setDescription(null);
        }
        if (\array_key_exists('endedAt', $data) && $data['endedAt'] !== null) {
            $object->setEndedAt($data['endedAt']);
        }
        elseif (\array_key_exists('endedAt', $data) && $data['endedAt'] === null) {
            $object->setEndedAt(null);
        }
        if (\array_key_exists('featureFlagId', $data)) {
            $object->setFeatureFlagId($data['featureFlagId']);
        }
        if (\array_key_exists('hypothesis', $data) && $data['hypothesis'] !== null) {
            $object->setHypothesis($data['hypothesis']);
        }
        elseif (\array_key_exists('hypothesis', $data) && $data['hypothesis'] === null) {
            $object->setHypothesis(null);
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('primaryMetricEventName', $data) && $data['primaryMetricEventName'] !== null) {
            $object->setPrimaryMetricEventName($data['primaryMetricEventName']);
        }
        elseif (\array_key_exists('primaryMetricEventName', $data) && $data['primaryMetricEventName'] === null) {
            $object->setPrimaryMetricEventName(null);
        }
        if (\array_key_exists('projectId', $data)) {
            $object->setProjectId($data['projectId']);
        }
        if (\array_key_exists('secondaryMetricEventNames', $data) && $data['secondaryMetricEventNames'] !== null) {
            $values = [];
            foreach ($data['secondaryMetricEventNames'] as $value) {
                $values[] = $value;
            }
            $object->setSecondaryMetricEventNames($values);
        }
        elseif (\array_key_exists('secondaryMetricEventNames', $data) && $data['secondaryMetricEventNames'] === null) {
            $object->setSecondaryMetricEventNames(null);
        }
        if (\array_key_exists('startedAt', $data) && $data['startedAt'] !== null) {
            $object->setStartedAt($data['startedAt']);
        }
        elseif (\array_key_exists('startedAt', $data) && $data['startedAt'] === null) {
            $object->setStartedAt(null);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        if (\array_key_exists('treatments', $data)) {
            $values_1 = [];
            foreach ($data['treatments'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\ExperimentTreatmentJsonEncoding::class, 'json', $context);
            }
            $object->setTreatments($values_1);
        }
        if (\array_key_exists('updatedAt', $data) && $data['updatedAt'] !== null) {
            $object->setUpdatedAt($data['updatedAt']);
        }
        elseif (\array_key_exists('updatedAt', $data) && $data['updatedAt'] === null) {
            $object->setUpdatedAt(null);
        }
        if (\array_key_exists('updatedByUserId', $data) && $data['updatedByUserId'] !== null) {
            $object->setUpdatedByUserId($data['updatedByUserId']);
        }
        elseif (\array_key_exists('updatedByUserId', $data) && $data['updatedByUserId'] === null) {
            $object->setUpdatedByUserId(null);
        }
        if (\array_key_exists('variants', $data)) {
            $values_2 = [];
            foreach ($data['variants'] as $value_2) {
                $values_2[] = $this->denormalizer->denormalize($value_2, \Voidhash\Generated\Core\Model\ExperimentVariantJsonEncoding::class, 'json', $context);
            }
            $object->setVariants($values_2);
        }
        if (\array_key_exists('version', $data)) {
            $object->setVersion($data['version']);
        }
        if (\array_key_exists('winningVariantId', $data) && $data['winningVariantId'] !== null) {
            $object->setWinningVariantId($data['winningVariantId']);
        }
        elseif (\array_key_exists('winningVariantId', $data) && $data['winningVariantId'] === null) {
            $object->setWinningVariantId(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['archivedAt'] = $data->getArchivedAt();
        $dataArray['backingFlag'] = $this->normalizer->normalize($data->getBackingFlag(), 'json', $context);
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['createdByUserId'] = $data->getCreatedByUserId();
        $dataArray['description'] = $data->getDescription();
        $dataArray['endedAt'] = $data->getEndedAt();
        $dataArray['featureFlagId'] = $data->getFeatureFlagId();
        $dataArray['hypothesis'] = $data->getHypothesis();
        $dataArray['id'] = $data->getId();
        $dataArray['name'] = $data->getName();
        $dataArray['primaryMetricEventName'] = $data->getPrimaryMetricEventName();
        $dataArray['projectId'] = $data->getProjectId();
        $values = [];
        foreach ($data->getSecondaryMetricEventNames() as $value) {
            $values[] = $value;
        }
        $dataArray['secondaryMetricEventNames'] = $values;
        $dataArray['startedAt'] = $data->getStartedAt();
        $dataArray['status'] = $data->getStatus();
        $values_1 = [];
        foreach ($data->getTreatments() as $value_1) {
            $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
        }
        $dataArray['treatments'] = $values_1;
        $dataArray['updatedAt'] = $data->getUpdatedAt();
        $dataArray['updatedByUserId'] = $data->getUpdatedByUserId();
        $values_2 = [];
        foreach ($data->getVariants() as $value_2) {
            $values_2[] = $this->normalizer->normalize($value_2, 'json', $context);
        }
        $dataArray['variants'] = $values_2;
        $dataArray['version'] = $data->getVersion();
        $dataArray['winningVariantId'] = $data->getWinningVariantId();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\ExperimentJsonEncoding1::class => false];
    }
}