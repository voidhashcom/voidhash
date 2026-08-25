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
class EvaluateProjectFeatureFlagsBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\EvaluateProjectFeatureFlagsBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\EvaluateProjectFeatureFlagsBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\EvaluateProjectFeatureFlagsBodyJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('distinctId', $data) && $data['distinctId'] !== null) {
            $object->setDistinctId($data['distinctId']);
        }
        elseif (\array_key_exists('distinctId', $data) && $data['distinctId'] === null) {
            $object->setDistinctId(null);
        }
        if (\array_key_exists('email', $data) && $data['email'] !== null) {
            $object->setEmail($data['email']);
        }
        elseif (\array_key_exists('email', $data) && $data['email'] === null) {
            $object->setEmail(null);
        }
        if (\array_key_exists('externalIds', $data) && $data['externalIds'] !== null) {
            $values = [];
            foreach ($data['externalIds'] as $value) {
                $values[] = $value;
            }
            $object->setExternalIds($values);
        }
        elseif (\array_key_exists('externalIds', $data) && $data['externalIds'] === null) {
            $object->setExternalIds(null);
        }
        if (\array_key_exists('keys', $data) && $data['keys'] !== null) {
            $values_1 = [];
            foreach ($data['keys'] as $value_1) {
                $values_1[] = $value_1;
            }
            $object->setKeys($values_1);
        }
        elseif (\array_key_exists('keys', $data) && $data['keys'] === null) {
            $object->setKeys(null);
        }
        if (\array_key_exists('personId', $data) && $data['personId'] !== null) {
            $object->setPersonId($data['personId']);
        }
        elseif (\array_key_exists('personId', $data) && $data['personId'] === null) {
            $object->setPersonId(null);
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
        if ($data->isInitialized('distinctId')) {
            $dataArray['distinctId'] = $data->getDistinctId();
        }
        if ($data->isInitialized('email')) {
            $dataArray['email'] = $data->getEmail();
        }
        if ($data->isInitialized('externalIds')) {
            $values = [];
            foreach ($data->getExternalIds() as $value) {
                $values[] = $value;
            }
            $dataArray['externalIds'] = $values;
        }
        if ($data->isInitialized('keys')) {
            $values_1 = [];
            foreach ($data->getKeys() as $value_1) {
                $values_1[] = $value_1;
            }
            $dataArray['keys'] = $values_1;
        }
        if ($data->isInitialized('personId')) {
            $dataArray['personId'] = $data->getPersonId();
        }
        if ($data->isInitialized('projectId')) {
            $dataArray['projectId'] = $data->getProjectId();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\EvaluateProjectFeatureFlagsBodyJsonEncoding::class => false];
    }
}