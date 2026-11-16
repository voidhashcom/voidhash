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
class AutomationJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AutomationJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AutomationJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AutomationJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('hasUnpublishedChanges', $data) && \is_int($data['hasUnpublishedChanges'])) {
            $data['hasUnpublishedChanges'] = (bool) $data['hasUnpublishedChanges'];
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
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        if (\array_key_exists('environment', $data)) {
            $object->setEnvironment($data['environment']);
        }
        if (\array_key_exists('definition', $data)) {
            $object->setDefinition($this->denormalizer->denormalize($data['definition'], \Voidhash\Generated\Core\Model\AutomationDefinition::class, 'json', $context));
        }
        if (\array_key_exists('revision', $data)) {
            $object->setRevision($data['revision']);
        }
        if (\array_key_exists('hasUnpublishedChanges', $data)) {
            $object->setHasUnpublishedChanges($data['hasUnpublishedChanges']);
        }
        if (\array_key_exists('activeVersionId', $data) && $data['activeVersionId'] !== null) {
            $object->setActiveVersionId($data['activeVersionId']);
        }
        elseif (\array_key_exists('activeVersionId', $data) && $data['activeVersionId'] === null) {
            $object->setActiveVersionId(null);
        }
        if (\array_key_exists('triggerType', $data) && $data['triggerType'] !== null) {
            $object->setTriggerType($data['triggerType']);
        }
        elseif (\array_key_exists('triggerType', $data) && $data['triggerType'] === null) {
            $object->setTriggerType(null);
        }
        if (\array_key_exists('activatedAt', $data) && $data['activatedAt'] !== null) {
            $object->setActivatedAt($data['activatedAt']);
        }
        elseif (\array_key_exists('activatedAt', $data) && $data['activatedAt'] === null) {
            $object->setActivatedAt(null);
        }
        if (\array_key_exists('nextFireAt', $data) && $data['nextFireAt'] !== null) {
            $object->setNextFireAt($data['nextFireAt']);
        }
        elseif (\array_key_exists('nextFireAt', $data) && $data['nextFireAt'] === null) {
            $object->setNextFireAt(null);
        }
        if (\array_key_exists('createdAt', $data)) {
            $object->setCreatedAt($data['createdAt']);
        }
        if (\array_key_exists('updatedAt', $data)) {
            $object->setUpdatedAt($data['updatedAt']);
        }
        if (\array_key_exists('issues', $data)) {
            $values = [];
            foreach ($data['issues'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AutomationIssue::class, 'json', $context);
            }
            $object->setIssues($values);
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
        $dataArray['status'] = $data->getStatus();
        $dataArray['environment'] = $data->getEnvironment();
        $dataArray['definition'] = $this->normalizer->normalize($data->getDefinition(), 'json', $context);
        $dataArray['revision'] = $data->getRevision();
        $dataArray['hasUnpublishedChanges'] = $data->getHasUnpublishedChanges();
        $dataArray['activeVersionId'] = $data->getActiveVersionId();
        $dataArray['triggerType'] = $data->getTriggerType();
        $dataArray['activatedAt'] = $data->getActivatedAt();
        $dataArray['nextFireAt'] = $data->getNextFireAt();
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['updatedAt'] = $data->getUpdatedAt();
        $values = [];
        foreach ($data->getIssues() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['issues'] = $values;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AutomationJsonEncoding::class => false];
    }
}