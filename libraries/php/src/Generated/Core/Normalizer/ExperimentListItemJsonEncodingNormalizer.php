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
class ExperimentListItemJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\ExperimentListItemJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\ExperimentListItemJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\ExperimentListItemJsonEncoding();
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
        if (\array_key_exists('paywallLocationIds', $data)) {
            $values = [];
            foreach ($data['paywallLocationIds'] as $value) {
                $values[] = $value;
            }
            $object->setPaywallLocationIds($values);
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
            $values_1 = [];
            foreach ($data['secondaryMetricEventNames'] as $value_1) {
                $values_1[] = $value_1;
            }
            $object->setSecondaryMetricEventNames($values_1);
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
        if (\array_key_exists('variantCount', $data)) {
            $object->setVariantCount($data['variantCount']);
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
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['createdByUserId'] = $data->getCreatedByUserId();
        $dataArray['description'] = $data->getDescription();
        $dataArray['endedAt'] = $data->getEndedAt();
        $dataArray['featureFlagId'] = $data->getFeatureFlagId();
        $dataArray['hypothesis'] = $data->getHypothesis();
        $dataArray['id'] = $data->getId();
        $dataArray['name'] = $data->getName();
        $values = [];
        foreach ($data->getPaywallLocationIds() as $value) {
            $values[] = $value;
        }
        $dataArray['paywallLocationIds'] = $values;
        $dataArray['primaryMetricEventName'] = $data->getPrimaryMetricEventName();
        $dataArray['projectId'] = $data->getProjectId();
        $values_1 = [];
        foreach ($data->getSecondaryMetricEventNames() as $value_1) {
            $values_1[] = $value_1;
        }
        $dataArray['secondaryMetricEventNames'] = $values_1;
        $dataArray['startedAt'] = $data->getStartedAt();
        $dataArray['status'] = $data->getStatus();
        $dataArray['updatedAt'] = $data->getUpdatedAt();
        $dataArray['updatedByUserId'] = $data->getUpdatedByUserId();
        $dataArray['variantCount'] = $data->getVariantCount();
        $dataArray['version'] = $data->getVersion();
        $dataArray['winningVariantId'] = $data->getWinningVariantId();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\ExperimentListItemJsonEncoding::class => false];
    }
}