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
class UpdateBoardTaskBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\UpdateBoardTaskBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\UpdateBoardTaskBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\UpdateBoardTaskBodyJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('title', $data) && $data['title'] !== null) {
            $object->setTitle($data['title']);
        }
        elseif (\array_key_exists('title', $data) && $data['title'] === null) {
            $object->setTitle(null);
        }
        if (\array_key_exists('description', $data) && $data['description'] !== null) {
            $object->setDescription($data['description']);
        }
        elseif (\array_key_exists('description', $data) && $data['description'] === null) {
            $object->setDescription(null);
        }
        if (\array_key_exists('assignees', $data) && $data['assignees'] !== null) {
            $values = [];
            foreach ($data['assignees'] as $value) {
                $values[] = $value;
            }
            $object->setAssignees($values);
        }
        elseif (\array_key_exists('assignees', $data) && $data['assignees'] === null) {
            $object->setAssignees(null);
        }
        if (\array_key_exists('addAssignees', $data) && $data['addAssignees'] !== null) {
            $values_1 = [];
            foreach ($data['addAssignees'] as $value_1) {
                $values_1[] = $value_1;
            }
            $object->setAddAssignees($values_1);
        }
        elseif (\array_key_exists('addAssignees', $data) && $data['addAssignees'] === null) {
            $object->setAddAssignees(null);
        }
        if (\array_key_exists('removeAssignees', $data) && $data['removeAssignees'] !== null) {
            $values_2 = [];
            foreach ($data['removeAssignees'] as $value_2) {
                $values_2[] = $value_2;
            }
            $object->setRemoveAssignees($values_2);
        }
        elseif (\array_key_exists('removeAssignees', $data) && $data['removeAssignees'] === null) {
            $object->setRemoveAssignees(null);
        }
        if (\array_key_exists('labelIds', $data) && $data['labelIds'] !== null) {
            $values_3 = [];
            foreach ($data['labelIds'] as $value_3) {
                $values_3[] = $value_3;
            }
            $object->setLabelIds($values_3);
        }
        elseif (\array_key_exists('labelIds', $data) && $data['labelIds'] === null) {
            $object->setLabelIds(null);
        }
        if (\array_key_exists('priority', $data)) {
            $object->setPriority($data['priority']);
        }
        if (\array_key_exists('dueDate', $data) && $data['dueDate'] !== null) {
            $object->setDueDate($data['dueDate']);
        }
        elseif (\array_key_exists('dueDate', $data) && $data['dueDate'] === null) {
            $object->setDueDate(null);
        }
        if (\array_key_exists('columnId', $data) && $data['columnId'] !== null) {
            $object->setColumnId($data['columnId']);
        }
        elseif (\array_key_exists('columnId', $data) && $data['columnId'] === null) {
            $object->setColumnId(null);
        }
        if (\array_key_exists('afterTaskId', $data) && $data['afterTaskId'] !== null) {
            $object->setAfterTaskId($data['afterTaskId']);
        }
        elseif (\array_key_exists('afterTaskId', $data) && $data['afterTaskId'] === null) {
            $object->setAfterTaskId(null);
        }
        if (\array_key_exists('beforeTaskId', $data) && $data['beforeTaskId'] !== null) {
            $object->setBeforeTaskId($data['beforeTaskId']);
        }
        elseif (\array_key_exists('beforeTaskId', $data) && $data['beforeTaskId'] === null) {
            $object->setBeforeTaskId(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        if ($data->isInitialized('title')) {
            $dataArray['title'] = $data->getTitle();
        }
        if ($data->isInitialized('description')) {
            $dataArray['description'] = $data->getDescription();
        }
        if ($data->isInitialized('assignees')) {
            $values = [];
            foreach ($data->getAssignees() as $value) {
                $values[] = $value;
            }
            $dataArray['assignees'] = $values;
        }
        if ($data->isInitialized('addAssignees')) {
            $values_1 = [];
            foreach ($data->getAddAssignees() as $value_1) {
                $values_1[] = $value_1;
            }
            $dataArray['addAssignees'] = $values_1;
        }
        if ($data->isInitialized('removeAssignees')) {
            $values_2 = [];
            foreach ($data->getRemoveAssignees() as $value_2) {
                $values_2[] = $value_2;
            }
            $dataArray['removeAssignees'] = $values_2;
        }
        if ($data->isInitialized('labelIds')) {
            $values_3 = [];
            foreach ($data->getLabelIds() as $value_3) {
                $values_3[] = $value_3;
            }
            $dataArray['labelIds'] = $values_3;
        }
        if ($data->isInitialized('priority') && null !== $data->getPriority()) {
            $dataArray['priority'] = $data->getPriority();
        }
        if ($data->isInitialized('dueDate')) {
            $dataArray['dueDate'] = $data->getDueDate();
        }
        if ($data->isInitialized('columnId')) {
            $dataArray['columnId'] = $data->getColumnId();
        }
        if ($data->isInitialized('afterTaskId')) {
            $dataArray['afterTaskId'] = $data->getAfterTaskId();
        }
        if ($data->isInitialized('beforeTaskId')) {
            $dataArray['beforeTaskId'] = $data->getBeforeTaskId();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\UpdateBoardTaskBodyJsonEncoding::class => false];
    }
}