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
class PaywallLocationDefaultAnswerJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PaywallLocationDefaultAnswerJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PaywallLocationDefaultAnswerJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PaywallLocationDefaultAnswerJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('answer', $data)) {
            $object->setAnswer($this->denormalizer->denormalize($data['answer'], \Voidhash\Generated\Core\Model\SdkResolvedPaywallJsonEncoding::class, 'json', $context));
        }
        if (\array_key_exists('interfaceRevision', $data)) {
            $object->setInterfaceRevision($data['interfaceRevision']);
        }
        if (\array_key_exists('experiment', $data) && $data['experiment'] !== null) {
            $object->setExperiment($this->denormalizer->denormalize($data['experiment'], \Voidhash\Generated\Core\Model\PaywallLocationDefaultAnswerJsonEncodingExperiment::class, 'json', $context));
        }
        elseif (\array_key_exists('experiment', $data) && $data['experiment'] === null) {
            $object->setExperiment(null);
        }
        if (\array_key_exists('withdrawnBuild', $data) && $data['withdrawnBuild'] !== null) {
            $object->setWithdrawnBuild($this->denormalizer->denormalize($data['withdrawnBuild'], \Voidhash\Generated\Core\Model\PaywallLocationDefaultAnswerJsonEncodingWithdrawnBuild::class, 'json', $context));
        }
        elseif (\array_key_exists('withdrawnBuild', $data) && $data['withdrawnBuild'] === null) {
            $object->setWithdrawnBuild(null);
        }
        if (\array_key_exists('requirements', $data)) {
            $object->setRequirements($this->denormalizer->denormalize($data['requirements'], \Voidhash\Generated\Core\Model\PaywallLocationDefaultAnswerJsonEncodingRequirements::class, 'json', $context));
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['answer'] = $this->normalizer->normalize($data->getAnswer(), 'json', $context);
        $dataArray['interfaceRevision'] = $data->getInterfaceRevision();
        $dataArray['experiment'] = $this->normalizer->normalize($data->getExperiment(), 'json', $context);
        $dataArray['withdrawnBuild'] = $this->normalizer->normalize($data->getWithdrawnBuild(), 'json', $context);
        $dataArray['requirements'] = $this->normalizer->normalize($data->getRequirements(), 'json', $context);
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PaywallLocationDefaultAnswerJsonEncoding::class => false];
    }
}