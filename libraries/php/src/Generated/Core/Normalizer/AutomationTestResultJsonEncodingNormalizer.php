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
class AutomationTestResultJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AutomationTestResultJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AutomationTestResultJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AutomationTestResultJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isMatch', $data) && \is_int($data['isMatch'])) {
            $data['isMatch'] = (bool) $data['isMatch'];
        }
        if (\array_key_exists('isComplete', $data) && \is_int($data['isComplete'])) {
            $data['isComplete'] = (bool) $data['isComplete'];
        }
        if (\array_key_exists('isMatch', $data)) {
            $object->setIsMatch($data['isMatch']);
        }
        if (\array_key_exists('isComplete', $data)) {
            $object->setIsComplete($data['isComplete']);
        }
        if (\array_key_exists('issues', $data)) {
            $values = [];
            foreach ($data['issues'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\AutomationIssue::class, 'json', $context);
            }
            $object->setIssues($values);
        }
        if (\array_key_exists('steps', $data)) {
            $values_1 = [];
            foreach ($data['steps'] as $value_1) {
                $values_1[] = $this->denormalizer->denormalize($value_1, \Voidhash\Generated\Core\Model\AutomationTestResultJsonEncodingStepsItem::class, 'json', $context);
            }
            $object->setSteps($values_1);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['isMatch'] = $data->getIsMatch();
        $dataArray['isComplete'] = $data->getIsComplete();
        $values = [];
        foreach ($data->getIssues() as $value) {
            $values[] = $this->normalizer->normalize($value, 'json', $context);
        }
        $dataArray['issues'] = $values;
        $values_1 = [];
        foreach ($data->getSteps() as $value_1) {
            $values_1[] = $this->normalizer->normalize($value_1, 'json', $context);
        }
        $dataArray['steps'] = $values_1;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AutomationTestResultJsonEncoding::class => false];
    }
}