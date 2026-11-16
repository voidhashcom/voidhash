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
class CreateBoardTaskBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\CreateBoardTaskBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\CreateBoardTaskBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\CreateBoardTaskBodyJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('title', $data)) {
            $object->setTitle($data['title']);
        }
        if (\array_key_exists('description', $data) && $data['description'] !== null) {
            $object->setDescription($data['description']);
        }
        elseif (\array_key_exists('description', $data) && $data['description'] === null) {
            $object->setDescription(null);
        }
        if (\array_key_exists('columnId', $data) && $data['columnId'] !== null) {
            $object->setColumnId($data['columnId']);
        }
        elseif (\array_key_exists('columnId', $data) && $data['columnId'] === null) {
            $object->setColumnId(null);
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
        if (\array_key_exists('labelIds', $data) && $data['labelIds'] !== null) {
            $values_1 = [];
            foreach ($data['labelIds'] as $value_1) {
                $values_1[] = $value_1;
            }
            $object->setLabelIds($values_1);
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
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['title'] = $data->getTitle();
        if ($data->isInitialized('description')) {
            $dataArray['description'] = $data->getDescription();
        }
        if ($data->isInitialized('columnId')) {
            $dataArray['columnId'] = $data->getColumnId();
        }
        if ($data->isInitialized('assignees')) {
            $values = [];
            foreach ($data->getAssignees() as $value) {
                $values[] = $value;
            }
            $dataArray['assignees'] = $values;
        }
        if ($data->isInitialized('labelIds')) {
            $values_1 = [];
            foreach ($data->getLabelIds() as $value_1) {
                $values_1[] = $value_1;
            }
            $dataArray['labelIds'] = $values_1;
        }
        if ($data->isInitialized('priority') && null !== $data->getPriority()) {
            $dataArray['priority'] = $data->getPriority();
        }
        if ($data->isInitialized('dueDate')) {
            $dataArray['dueDate'] = $data->getDueDate();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\CreateBoardTaskBodyJsonEncoding::class => false];
    }
}