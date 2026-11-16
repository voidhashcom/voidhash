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
class AnalyticsCohortDefinitionNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AnalyticsCohortDefinition::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AnalyticsCohortDefinition::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AnalyticsCohortDefinition();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('match', $data)) {
            $object->setMatch($data['match']);
        }
        if (\array_key_exists('conditions', $data)) {
            $values = [];
            foreach ($data['conditions'] as $value) {
                $value_1 = $value;
                if (is_array($value) and (\array_key_exists('kind', $value) and $value['kind'] == 'trait') and \array_key_exists('key', $value) and (\array_key_exists('op', $value) and ($value['op'] == 'in' or $value['op'] == 'not_in' or $value['op'] == 'contains' or $value['op'] == 'not_contains' or $value['op'] == 'starts_with' or $value['op'] == 'ends_with' or $value['op'] == 'regex' or $value['op'] == 'not_regex' or $value['op'] == 'is_set' or $value['op'] == 'is_not_set' or $value['op'] == 'gt' or $value['op'] == 'lt')) and \array_key_exists('values', $value)) {
                    $value_1 = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AnalyticsCohortTraitCondition::class, 'json', $context);
                } elseif (is_array($value) and (\array_key_exists('kind', $value) and $value['kind'] == 'performed') and \array_key_exists('event', $value) and \array_key_exists('isNegated', $value) and \array_key_exists('count', $value) and \array_key_exists('withinDays', $value) and \array_key_exists('filters', $value)) {
                    $value_1 = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AnalyticsCohortPerformedCondition::class, 'json', $context);
                } elseif (is_array($value) and (\array_key_exists('kind', $value) and $value['kind'] == 'first_time') and \array_key_exists('event', $value) and \array_key_exists('withinDays', $value)) {
                    $value_1 = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AnalyticsCohortFirstTimeCondition::class, 'json', $context);
                } elseif (is_array($value) and (\array_key_exists('kind', $value) and $value['kind'] == 'cohort') and \array_key_exists('cohortId', $value) and \array_key_exists('isNegated', $value)) {
                    $value_1 = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AnalyticsCohortCohortCondition::class, 'json', $context);
                } elseif (is_array($value) and (\array_key_exists('kind', $value) and $value['kind'] == 'group') and \array_key_exists('groupType', $value) and \array_key_exists('key', $value) and (\array_key_exists('op', $value) and ($value['op'] == 'in' or $value['op'] == 'not_in' or $value['op'] == 'contains' or $value['op'] == 'not_contains' or $value['op'] == 'starts_with' or $value['op'] == 'ends_with' or $value['op'] == 'regex' or $value['op'] == 'not_regex' or $value['op'] == 'is_set' or $value['op'] == 'is_not_set' or $value['op'] == 'gt' or $value['op'] == 'lt')) and \array_key_exists('values', $value)) {
                    $value_1 = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AnalyticsCohortGroupCondition::class, 'json', $context);
                }
                $values[] = $value_1;
            }
            $object->setConditions($values);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['match'] = $data->getMatch();
        $values = [];
        foreach ($data->getConditions() as $value) {
            $value_1 = $value;
            if (is_object($value)) {
                $value_1 = $this->normalizer->normalize($value, 'json', $context);
            } elseif (is_object($value)) {
                $value_1 = $this->normalizer->normalize($value, 'json', $context);
            } elseif (is_object($value)) {
                $value_1 = $this->normalizer->normalize($value, 'json', $context);
            } elseif (is_object($value)) {
                $value_1 = $this->normalizer->normalize($value, 'json', $context);
            } elseif (is_object($value)) {
                $value_1 = $this->normalizer->normalize($value, 'json', $context);
            }
            $values[] = $value_1;
        }
        $dataArray['conditions'] = $values;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AnalyticsCohortDefinition::class => false];
    }
}