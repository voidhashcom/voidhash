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
class CreateCommentBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\CreateCommentBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\CreateCommentBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\CreateCommentBodyJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('subjectType', $data)) {
            $object->setSubjectType($data['subjectType']);
        }
        if (\array_key_exists('subjectId', $data)) {
            $object->setSubjectId($data['subjectId']);
        }
        if (\array_key_exists('body', $data)) {
            $object->setBody($data['body']);
        }
        if (\array_key_exists('attachmentIds', $data) && $data['attachmentIds'] !== null) {
            $values = [];
            foreach ($data['attachmentIds'] as $value) {
                $values[] = $value;
            }
            $object->setAttachmentIds($values);
        }
        elseif (\array_key_exists('attachmentIds', $data) && $data['attachmentIds'] === null) {
            $object->setAttachmentIds(null);
        }
        if (\array_key_exists('parentId', $data) && $data['parentId'] !== null) {
            $object->setParentId($data['parentId']);
        }
        elseif (\array_key_exists('parentId', $data) && $data['parentId'] === null) {
            $object->setParentId(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['subjectType'] = $data->getSubjectType();
        $dataArray['subjectId'] = $data->getSubjectId();
        $dataArray['body'] = $data->getBody();
        if ($data->isInitialized('attachmentIds')) {
            $values = [];
            foreach ($data->getAttachmentIds() as $value) {
                $values[] = $value;
            }
            $dataArray['attachmentIds'] = $values;
        }
        if ($data->isInitialized('parentId')) {
            $dataArray['parentId'] = $data->getParentId();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\CreateCommentBodyJsonEncoding::class => false];
    }
}