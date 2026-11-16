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
class InboxItemJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\InboxItemJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\InboxItemJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\InboxItemJsonEncoding();
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
        if (\array_key_exists('subjectType', $data)) {
            $object->setSubjectType($data['subjectType']);
        }
        if (\array_key_exists('subjectId', $data)) {
            $object->setSubjectId($data['subjectId']);
        }
        if (\array_key_exists('title', $data)) {
            $object->setTitle($data['title']);
        }
        if (\array_key_exists('place', $data) && $data['place'] !== null) {
            $object->setPlace($data['place']);
        }
        elseif (\array_key_exists('place', $data) && $data['place'] === null) {
            $object->setPlace(null);
        }
        if (\array_key_exists('kind', $data)) {
            $object->setKind($data['kind']);
        }
        if (\array_key_exists('actor', $data)) {
            $object->setActor($data['actor']);
        }
        if (\array_key_exists('data', $data)) {
            $values = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['data'] as $key => $value) {
                $values[$key] = $value;
            }
            $object->setData($values);
        }
        if (\array_key_exists('commentId', $data) && $data['commentId'] !== null) {
            $object->setCommentId($data['commentId']);
        }
        elseif (\array_key_exists('commentId', $data) && $data['commentId'] === null) {
            $object->setCommentId(null);
        }
        if (\array_key_exists('snippet', $data) && $data['snippet'] !== null) {
            $object->setSnippet($data['snippet']);
        }
        elseif (\array_key_exists('snippet', $data) && $data['snippet'] === null) {
            $object->setSnippet(null);
        }
        if (\array_key_exists('occurredAt', $data)) {
            $object->setOccurredAt($data['occurredAt']);
        }
        if (\array_key_exists('readAt', $data) && $data['readAt'] !== null) {
            $object->setReadAt($data['readAt']);
        }
        elseif (\array_key_exists('readAt', $data) && $data['readAt'] === null) {
            $object->setReadAt(null);
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
        $dataArray['subjectType'] = $data->getSubjectType();
        $dataArray['subjectId'] = $data->getSubjectId();
        $dataArray['title'] = $data->getTitle();
        $dataArray['place'] = $data->getPlace();
        $dataArray['kind'] = $data->getKind();
        $dataArray['actor'] = $data->getActor();
        $values = [];
        foreach ($data->getData() as $key => $value) {
            $values[$key] = $value;
        }
        $dataArray['data'] = $values;
        $dataArray['commentId'] = $data->getCommentId();
        $dataArray['snippet'] = $data->getSnippet();
        $dataArray['occurredAt'] = $data->getOccurredAt();
        $dataArray['readAt'] = $data->getReadAt();
        $dataArray['archivedAt'] = $data->getArchivedAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\InboxItemJsonEncoding::class => false];
    }
}