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
class InsightInputFunnelNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\InsightInputFunnel::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\InsightInputFunnel::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\InsightInputFunnel();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('order', $data)) {
            $object->setOrder($data['order']);
        }
        if (\array_key_exists('windowValue', $data)) {
            $object->setWindowValue($data['windowValue']);
        }
        if (\array_key_exists('windowUnit', $data)) {
            $object->setWindowUnit($data['windowUnit']);
        }
        if (\array_key_exists('reference', $data)) {
            $object->setReference($data['reference']);
        }
        if (\array_key_exists('view', $data)) {
            $object->setView($data['view']);
        }
        if (\array_key_exists('layout', $data)) {
            $object->setLayout($data['layout']);
        }
        if (\array_key_exists('exclusions', $data)) {
            $values = [];
            foreach ($data['exclusions'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\FunnelExclusionSteps::class, 'json', $context);
            }
            $object->setExclusions($values);
        }
        if (\array_key_exists('attribution', $data)) {
            $object->setAttribution($data['attribution']);
        }
        if (\array_key_exists('attributionStep', $data)) {
            $object->setAttributionStep($data['attributionStep']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        if ($data->isInitialized('order') && null !== $data->getOrder()) {
            $dataArray['order'] = $data->getOrder();
        }
        if ($data->isInitialized('windowValue') && null !== $data->getWindowValue()) {
            $dataArray['windowValue'] = $data->getWindowValue();
        }
        if ($data->isInitialized('windowUnit') && null !== $data->getWindowUnit()) {
            $dataArray['windowUnit'] = $data->getWindowUnit();
        }
        if ($data->isInitialized('reference') && null !== $data->getReference()) {
            $dataArray['reference'] = $data->getReference();
        }
        if ($data->isInitialized('view') && null !== $data->getView()) {
            $dataArray['view'] = $data->getView();
        }
        if ($data->isInitialized('layout') && null !== $data->getLayout()) {
            $dataArray['layout'] = $data->getLayout();
        }
        if ($data->isInitialized('exclusions') && null !== $data->getExclusions()) {
            $values = [];
            foreach ($data->getExclusions() as $value) {
                $values[] = $this->normalizer->normalize($value, 'json', $context);
            }
            $dataArray['exclusions'] = $values;
        }
        if ($data->isInitialized('attribution') && null !== $data->getAttribution()) {
            $dataArray['attribution'] = $data->getAttribution();
        }
        if ($data->isInitialized('attributionStep') && null !== $data->getAttributionStep()) {
            $dataArray['attributionStep'] = $data->getAttributionStep();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\InsightInputFunnel::class => false];
    }
}