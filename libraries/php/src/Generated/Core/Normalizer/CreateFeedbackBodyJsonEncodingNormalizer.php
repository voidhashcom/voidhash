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
class CreateFeedbackBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\CreateFeedbackBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\CreateFeedbackBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\CreateFeedbackBodyJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('topic', $data)) {
            $object->setTopic($data['topic']);
        }
        if (\array_key_exists('sentiment', $data) && $data['sentiment'] !== null) {
            $object->setSentiment($data['sentiment']);
        }
        elseif (\array_key_exists('sentiment', $data) && $data['sentiment'] === null) {
            $object->setSentiment(null);
        }
        if (\array_key_exists('message', $data)) {
            $object->setMessage($data['message']);
        }
        if (\array_key_exists('organizationId', $data) && $data['organizationId'] !== null) {
            $object->setOrganizationId($data['organizationId']);
        }
        elseif (\array_key_exists('organizationId', $data) && $data['organizationId'] === null) {
            $object->setOrganizationId(null);
        }
        if (\array_key_exists('projectId', $data) && $data['projectId'] !== null) {
            $object->setProjectId($data['projectId']);
        }
        elseif (\array_key_exists('projectId', $data) && $data['projectId'] === null) {
            $object->setProjectId(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['topic'] = $data->getTopic();
        if ($data->isInitialized('sentiment')) {
            $dataArray['sentiment'] = $data->getSentiment();
        }
        $dataArray['message'] = $data->getMessage();
        if ($data->isInitialized('organizationId')) {
            $dataArray['organizationId'] = $data->getOrganizationId();
        }
        if ($data->isInitialized('projectId')) {
            $dataArray['projectId'] = $data->getProjectId();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\CreateFeedbackBodyJsonEncoding::class => false];
    }
}