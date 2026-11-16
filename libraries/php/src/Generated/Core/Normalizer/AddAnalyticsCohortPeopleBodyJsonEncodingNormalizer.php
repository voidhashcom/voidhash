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
class AddAnalyticsCohortPeopleBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AddAnalyticsCohortPeopleBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AddAnalyticsCohortPeopleBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AddAnalyticsCohortPeopleBodyJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('personIds', $data) && $data['personIds'] !== null) {
            $values = [];
            foreach ($data['personIds'] as $value) {
                $values[] = $value;
            }
            $object->setPersonIds($values);
        }
        elseif (\array_key_exists('personIds', $data) && $data['personIds'] === null) {
            $object->setPersonIds(null);
        }
        if (\array_key_exists('distinctIds', $data) && $data['distinctIds'] !== null) {
            $values_1 = [];
            foreach ($data['distinctIds'] as $value_1) {
                $values_1[] = $value_1;
            }
            $object->setDistinctIds($values_1);
        }
        elseif (\array_key_exists('distinctIds', $data) && $data['distinctIds'] === null) {
            $object->setDistinctIds(null);
        }
        if (\array_key_exists('emails', $data) && $data['emails'] !== null) {
            $values_2 = [];
            foreach ($data['emails'] as $value_2) {
                $values_2[] = $value_2;
            }
            $object->setEmails($values_2);
        }
        elseif (\array_key_exists('emails', $data) && $data['emails'] === null) {
            $object->setEmails(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        if ($data->isInitialized('personIds')) {
            $values = [];
            foreach ($data->getPersonIds() as $value) {
                $values[] = $value;
            }
            $dataArray['personIds'] = $values;
        }
        if ($data->isInitialized('distinctIds')) {
            $values_1 = [];
            foreach ($data->getDistinctIds() as $value_1) {
                $values_1[] = $value_1;
            }
            $dataArray['distinctIds'] = $values_1;
        }
        if ($data->isInitialized('emails')) {
            $values_2 = [];
            foreach ($data->getEmails() as $value_2) {
                $values_2[] = $value_2;
            }
            $dataArray['emails'] = $values_2;
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AddAnalyticsCohortPeopleBodyJsonEncoding::class => false];
    }
}