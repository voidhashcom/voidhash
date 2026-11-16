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
class SessionJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\SessionJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\SessionJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\SessionJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isReadOnly', $data) && \is_int($data['isReadOnly'])) {
            $data['isReadOnly'] = (bool) $data['isReadOnly'];
        }
        if (\array_key_exists('kind', $data)) {
            $object->setKind($data['kind']);
        }
        if (\array_key_exists('person', $data)) {
            $object->setPerson($this->denormalizer->denormalize($data['person'], \Voidhash\Generated\Core\Model\SessionPersonJsonEncoding::class, 'json', $context));
        }
        if (\array_key_exists('connectedAppId', $data) && $data['connectedAppId'] !== null) {
            $object->setConnectedAppId($data['connectedAppId']);
        }
        elseif (\array_key_exists('connectedAppId', $data) && $data['connectedAppId'] === null) {
            $object->setConnectedAppId(null);
        }
        if (\array_key_exists('isReadOnly', $data)) {
            $object->setIsReadOnly($data['isReadOnly']);
        }
        if (\array_key_exists('organizations', $data)) {
            $values = [];
            foreach ($data['organizations'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\SessionOrganizationJsonEncoding::class, 'json', $context);
            }
            $object->setOrganizations($values);
        }
        if (\array_key_exists('projects', $data)) {
            $values_1 = [];
            foreach ($data['projects'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\SessionProjectJsonEncoding::class, 'json', $context);
            }
            $object->setProjects($values_1);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['kind'] = $data->getKind();
        $dataArray['person'] = $this->normalizer->normalize($data->getPerson(), 'json', $context);
        $dataArray['connectedAppId'] = $data->getConnectedAppId();
        $dataArray['isReadOnly'] = $data->getIsReadOnly();
        $values = [];
        foreach ($data->getOrganizations() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['organizations'] = $values;
        $values_1 = [];
        foreach ($data->getProjects() as $value_1) {
            $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
        }
        $dataArray['projects'] = $values_1;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\SessionJsonEncoding::class => false];
    }
}