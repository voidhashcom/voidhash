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
class BoardTaskJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\BoardTaskJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\BoardTaskJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\BoardTaskJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('boardId', $data)) {
            $object->setBoardId($data['boardId']);
        }
        if (\array_key_exists('title', $data)) {
            $object->setTitle($data['title']);
        }
        if (\array_key_exists('description', $data)) {
            $object->setDescription($data['description']);
        }
        if (\array_key_exists('columnId', $data)) {
            $object->setColumnId($data['columnId']);
        }
        if (\array_key_exists('assignees', $data)) {
            $values = [];
            foreach ($data['assignees'] as $value) {
                $values[] = $value;
            }
            $object->setAssignees($values);
        }
        if (\array_key_exists('labelIds', $data)) {
            $values_1 = [];
            foreach ($data['labelIds'] as $value_1) {
                $values_1[] = $value_1;
            }
            $object->setLabelIds($values_1);
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
        if (\array_key_exists('commentCount', $data)) {
            $object->setCommentCount($data['commentCount']);
        }
        if (\array_key_exists('archivedAt', $data) && $data['archivedAt'] !== null) {
            $object->setArchivedAt($data['archivedAt']);
        }
        elseif (\array_key_exists('archivedAt', $data) && $data['archivedAt'] === null) {
            $object->setArchivedAt(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['boardId'] = $data->getBoardId();
        $dataArray['title'] = $data->getTitle();
        $dataArray['description'] = $data->getDescription();
        $dataArray['columnId'] = $data->getColumnId();
        $values = [];
        foreach ($data->getAssignees() as $value) {
            $values[] = $value;
        }
        $dataArray['assignees'] = $values;
        $values_1 = [];
        foreach ($data->getLabelIds() as $value_1) {
            $values_1[] = $value_1;
        }
        $dataArray['labelIds'] = $values_1;
        $dataArray['priority'] = $data->getPriority();
        $dataArray['dueDate'] = $data->getDueDate();
        $dataArray['commentCount'] = $data->getCommentCount();
        $dataArray['archivedAt'] = $data->getArchivedAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\BoardTaskJsonEncoding::class => false];
    }
}