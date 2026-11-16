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
class AutomationSettingsNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\AutomationSettings::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\AutomationSettings::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\AutomationSettings();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('reentry', $data)) {
            $object->setReentry($data['reentry']);
        }
        if (\array_key_exists('cooldown', $data)) {
            $object->setCooldown($this->denormalizer->denormalize($data['cooldown'], \Voidhash\Generated\Core\Model\AutomationDuration::class, 'json', $context));
        }
        if (\array_key_exists('exitOn', $data) && $data['exitOn'] !== null) {
            $values = [];
            foreach ($data['exitOn'] as $value) {
                $values[] = $value;
            }
            $object->setExitOn($values);
        }
        elseif (\array_key_exists('exitOn', $data) && $data['exitOn'] === null) {
            $object->setExitOn(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['reentry'] = $data->getReentry();
        if ($data->isInitialized('cooldown') && null !== $data->getCooldown()) {
            $dataArray['cooldown'] = $this->normalizer->normalize($data->getCooldown(), 'json', $context);
        }
        if ($data->isInitialized('exitOn')) {
            $values = [];
            foreach ($data->getExitOn() as $value) {
                $values[] = $value;
            }
            $dataArray['exitOn'] = $values;
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\AutomationSettings::class => false];
    }
}