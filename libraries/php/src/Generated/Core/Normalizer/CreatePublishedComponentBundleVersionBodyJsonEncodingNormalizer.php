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
class CreatePublishedComponentBundleVersionBodyJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\CreatePublishedComponentBundleVersionBodyJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\CreatePublishedComponentBundleVersionBodyJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\CreatePublishedComponentBundleVersionBodyJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('definitionJson', $data)) {
            $object->setDefinitionJson($data['definitionJson']);
        }
        if (\array_key_exists('moduleBase64', $data)) {
            $object->setModuleBase64($data['moduleBase64']);
        }
        if (\array_key_exists('panelBase64', $data) && $data['panelBase64'] !== null) {
            $object->setPanelBase64($data['panelBase64']);
        }
        elseif (\array_key_exists('panelBase64', $data) && $data['panelBase64'] === null) {
            $object->setPanelBase64(null);
        }
        if (\array_key_exists('icon', $data)) {
            $object->setIcon($this->denormalizer->denormalize($data['icon'], \Voidhash\Generated\Core\Model\PublishedComponentBundleFile::class, 'json', $context));
        }
        if (\array_key_exists('thumbnails', $data) && $data['thumbnails'] !== null) {
            $values = [];
            foreach ($data['thumbnails'] as $value) {
                $values[] = $this->denormalizer->denormalize($value, \Voidhash\Generated\Core\Model\PublishedComponentThumbnail::class, 'json', $context);
            }
            $object->setThumbnails($values);
        }
        elseif (\array_key_exists('thumbnails', $data) && $data['thumbnails'] === null) {
            $object->setThumbnails(null);
        }
        if (\array_key_exists('readme', $data) && $data['readme'] !== null) {
            $object->setReadme($data['readme']);
        }
        elseif (\array_key_exists('readme', $data) && $data['readme'] === null) {
            $object->setReadme(null);
        }
        if (\array_key_exists('agentGuide', $data) && $data['agentGuide'] !== null) {
            $object->setAgentGuide($data['agentGuide']);
        }
        elseif (\array_key_exists('agentGuide', $data) && $data['agentGuide'] === null) {
            $object->setAgentGuide(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['definitionJson'] = $data->getDefinitionJson();
        $dataArray['moduleBase64'] = $data->getModuleBase64();
        if ($data->isInitialized('panelBase64')) {
            $dataArray['panelBase64'] = $data->getPanelBase64();
        }
        if ($data->isInitialized('icon') && null !== $data->getIcon()) {
            $dataArray['icon'] = $this->normalizer->normalize($data->getIcon(), 'json', $context);
        }
        if ($data->isInitialized('thumbnails')) {
            $values = [];
            foreach ($data->getThumbnails() as $value) {
                $values[] = $this->normalizer->normalize($value, 'json', $context);
            }
            $dataArray['thumbnails'] = $values;
        }
        if ($data->isInitialized('readme')) {
            $dataArray['readme'] = $data->getReadme();
        }
        if ($data->isInitialized('agentGuide')) {
            $dataArray['agentGuide'] = $data->getAgentGuide();
        }
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\CreatePublishedComponentBundleVersionBodyJsonEncoding::class => false];
    }
}