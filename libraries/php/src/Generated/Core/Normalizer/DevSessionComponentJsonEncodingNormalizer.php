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
class DevSessionComponentJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\DevSessionComponentJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\DevSessionComponentJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\DevSessionComponentJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isModified', $data) && \is_int($data['isModified'])) {
            $data['isModified'] = (bool) $data['isModified'];
        }
        if (\array_key_exists('isConflicted', $data) && \is_int($data['isConflicted'])) {
            $data['isConflicted'] = (bool) $data['isConflicted'];
        }
        if (\array_key_exists('slug', $data)) {
            $object->setSlug($data['slug']);
        }
        if (\array_key_exists('definitionId', $data)) {
            $object->setDefinitionId($data['definitionId']);
        }
        if (\array_key_exists('title', $data)) {
            $object->setTitle($data['title']);
        }
        if (\array_key_exists('origin', $data)) {
            $object->setOrigin($data['origin']);
        }
        if (\array_key_exists('baseVersion', $data)) {
            $object->setBaseVersion($data['baseVersion']);
        }
        if (\array_key_exists('publishedVersion', $data)) {
            $object->setPublishedVersion($data['publishedVersion']);
        }
        if (\array_key_exists('isModified', $data)) {
            $object->setIsModified($data['isModified']);
        }
        if (\array_key_exists('isConflicted', $data)) {
            $object->setIsConflicted($data['isConflicted']);
        }
        if (\array_key_exists('build', $data)) {
            $object->setBuild($this->denormalizer->denormalize($data['build'], \Voidhash\Generated\Core\Model\DevSessionBuild::class, 'json', $context));
        }
        if (\array_key_exists('moduleHash', $data)) {
            $object->setModuleHash($data['moduleHash']);
        }
        if (\array_key_exists('panelHash', $data)) {
            $object->setPanelHash($data['panelHash']);
        }
        if (\array_key_exists('definition', $data)) {
            $object->setDefinition($data['definition']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['slug'] = $data->getSlug();
        $dataArray['definitionId'] = $data->getDefinitionId();
        $dataArray['title'] = $data->getTitle();
        $dataArray['origin'] = $data->getOrigin();
        if ($data->isInitialized('baseVersion') && null !== $data->getBaseVersion()) {
            $dataArray['baseVersion'] = $data->getBaseVersion();
        }
        if ($data->isInitialized('publishedVersion') && null !== $data->getPublishedVersion()) {
            $dataArray['publishedVersion'] = $data->getPublishedVersion();
        }
        $dataArray['isModified'] = $data->getIsModified();
        $dataArray['isConflicted'] = $data->getIsConflicted();
        $dataArray['build'] = $this->normalizer->normalize($data->getBuild(), 'json', $context);
        if ($data->isInitialized('moduleHash') && null !== $data->getModuleHash()) {
            $dataArray['moduleHash'] = $data->getModuleHash();
        }
        if ($data->isInitialized('panelHash') && null !== $data->getPanelHash()) {
            $dataArray['panelHash'] = $data->getPanelHash();
        }
        if ($data->isInitialized('definition') && null !== $data->getDefinition()) {
            $dataArray['definition'] = $data->getDefinition();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\DevSessionComponentJsonEncoding::class => false];
    }
}