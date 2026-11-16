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
class ApiKeyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\ApiKeyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\ApiKeyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\ApiKeyJsonEncoding();
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
        if (\array_key_exists('name', $data)) {
            $object->setName($data['name']);
        }
        if (\array_key_exists('type', $data)) {
            $object->setType($data['type']);
        }
        if (\array_key_exists('environment', $data)) {
            $object->setEnvironment($data['environment']);
        }
        if (\array_key_exists('prefix', $data)) {
            $object->setPrefix($data['prefix']);
        }
        if (\array_key_exists('end', $data)) {
            $object->setEnd($data['end']);
        }
        if (\array_key_exists('rawKey', $data) && $data['rawKey'] !== null) {
            $object->setRawKey($data['rawKey']);
        }
        elseif (\array_key_exists('rawKey', $data) && $data['rawKey'] === null) {
            $object->setRawKey(null);
        }
        if (\array_key_exists('scopes', $data) && $data['scopes'] !== null) {
            $values = [];
            foreach ($data['scopes'] as $value) {
                $values[] = $value;
            }
            $object->setScopes($values);
        }
        elseif (\array_key_exists('scopes', $data) && $data['scopes'] === null) {
            $object->setScopes(null);
        }
        if (\array_key_exists('expiresAt', $data) && $data['expiresAt'] !== null) {
            $object->setExpiresAt($data['expiresAt']);
        }
        elseif (\array_key_exists('expiresAt', $data) && $data['expiresAt'] === null) {
            $object->setExpiresAt(null);
        }
        if (\array_key_exists('lastUsedAt', $data) && $data['lastUsedAt'] !== null) {
            $object->setLastUsedAt($data['lastUsedAt']);
        }
        elseif (\array_key_exists('lastUsedAt', $data) && $data['lastUsedAt'] === null) {
            $object->setLastUsedAt(null);
        }
        if (\array_key_exists('previousKeyExpiresAt', $data) && $data['previousKeyExpiresAt'] !== null) {
            $object->setPreviousKeyExpiresAt($data['previousKeyExpiresAt']);
        }
        elseif (\array_key_exists('previousKeyExpiresAt', $data) && $data['previousKeyExpiresAt'] === null) {
            $object->setPreviousKeyExpiresAt(null);
        }
        if (\array_key_exists('createdAt', $data) && $data['createdAt'] !== null) {
            $object->setCreatedAt($data['createdAt']);
        }
        elseif (\array_key_exists('createdAt', $data) && $data['createdAt'] === null) {
            $object->setCreatedAt(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['projectId'] = $data->getProjectId();
        $dataArray['name'] = $data->getName();
        $dataArray['type'] = $data->getType();
        $dataArray['environment'] = $data->getEnvironment();
        $dataArray['prefix'] = $data->getPrefix();
        $dataArray['end'] = $data->getEnd();
        $dataArray['rawKey'] = $data->getRawKey();
        $values = [];
        foreach ($data->getScopes() as $value) {
            $values[] = $value;
        }
        $dataArray['scopes'] = $values;
        $dataArray['expiresAt'] = $data->getExpiresAt();
        $dataArray['lastUsedAt'] = $data->getLastUsedAt();
        $dataArray['previousKeyExpiresAt'] = $data->getPreviousKeyExpiresAt();
        $dataArray['createdAt'] = $data->getCreatedAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\ApiKeyJsonEncoding::class => false];
    }
}