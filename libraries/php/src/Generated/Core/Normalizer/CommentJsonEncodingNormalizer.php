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
class CommentJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\CommentJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\CommentJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\CommentJsonEncoding();
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
        if (\array_key_exists('projectId', $data)) {
            $object->setProjectId($data['projectId']);
        }
        if (\array_key_exists('subjectType', $data)) {
            $object->setSubjectType($data['subjectType']);
        }
        if (\array_key_exists('subjectId', $data)) {
            $object->setSubjectId($data['subjectId']);
        }
        if (\array_key_exists('parentId', $data) && $data['parentId'] !== null) {
            $object->setParentId($data['parentId']);
        }
        elseif (\array_key_exists('parentId', $data) && $data['parentId'] === null) {
            $object->setParentId(null);
        }
        if (\array_key_exists('author', $data)) {
            $object->setAuthor($data['author']);
        }
        if (\array_key_exists('body', $data)) {
            $object->setBody($data['body']);
        }
        if (\array_key_exists('mentions', $data)) {
            $values = [];
            foreach ($data['mentions'] as $value) {
                $values[] = $value;
            }
            $object->setMentions($values);
        }
        if (\array_key_exists('attachmentIds', $data)) {
            $values_1 = [];
            foreach ($data['attachmentIds'] as $value_1) {
                $values_1[] = $value_1;
            }
            $object->setAttachmentIds($values_1);
        }
        if (\array_key_exists('reactions', $data)) {
            $values_2 = [];
            foreach ($data['reactions'] as $value_2) {
                $values_2[] = $this->denormalizer->denormalize($value_2, \Voidhash\Generated\Core\Model\CommentReactionJsonEncoding::class, 'json', $context);
            }
            $object->setReactions($values_2);
        }
        if (\array_key_exists('createdAt', $data)) {
            $object->setCreatedAt($data['createdAt']);
        }
        if (\array_key_exists('editedAt', $data) && $data['editedAt'] !== null) {
            $object->setEditedAt($data['editedAt']);
        }
        elseif (\array_key_exists('editedAt', $data) && $data['editedAt'] === null) {
            $object->setEditedAt(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['projectId'] = $data->getProjectId();
        $dataArray['subjectType'] = $data->getSubjectType();
        $dataArray['subjectId'] = $data->getSubjectId();
        $dataArray['parentId'] = $data->getParentId();
        $dataArray['author'] = $data->getAuthor();
        $dataArray['body'] = $data->getBody();
        $values = [];
        foreach ($data->getMentions() as $value) {
            $values[] = $value;
        }
        $dataArray['mentions'] = $values;
        $values_1 = [];
        foreach ($data->getAttachmentIds() as $value_1) {
            $values_1[] = $value_1;
        }
        $dataArray['attachmentIds'] = $values_1;
        $values_2 = [];
        foreach ($data->getReactions() as $value_2) {
            $values_2[] = $this->normalizer->normalize($value_2, 'json', $context);
        }
        $dataArray['reactions'] = $values_2;
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['editedAt'] = $data->getEditedAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\CommentJsonEncoding::class => false];
    }
}