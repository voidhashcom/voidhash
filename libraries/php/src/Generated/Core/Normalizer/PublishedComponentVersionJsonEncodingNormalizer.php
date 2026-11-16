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
class PublishedComponentVersionJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PublishedComponentVersionJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PublishedComponentVersionJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PublishedComponentVersionJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('hasPanel', $data) && \is_int($data['hasPanel'])) {
            $data['hasPanel'] = (bool) $data['hasPanel'];
        }
        if (\array_key_exists('hasIcon', $data) && \is_int($data['hasIcon'])) {
            $data['hasIcon'] = (bool) $data['hasIcon'];
        }
        if (\array_key_exists('hasReadme', $data) && \is_int($data['hasReadme'])) {
            $data['hasReadme'] = (bool) $data['hasReadme'];
        }
        if (\array_key_exists('hasAgentGuide', $data) && \is_int($data['hasAgentGuide'])) {
            $data['hasAgentGuide'] = (bool) $data['hasAgentGuide'];
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('registryComponentId', $data)) {
            $object->setRegistryComponentId($data['registryComponentId']);
        }
        if (\array_key_exists('version', $data)) {
            $object->setVersion($data['version']);
        }
        if (\array_key_exists('number', $data)) {
            $object->setNumber($data['number']);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        if (\array_key_exists('statusMessage', $data) && $data['statusMessage'] !== null) {
            $object->setStatusMessage($data['statusMessage']);
        }
        elseif (\array_key_exists('statusMessage', $data) && $data['statusMessage'] === null) {
            $object->setStatusMessage(null);
        }
        if (\array_key_exists('bundleHash', $data)) {
            $object->setBundleHash($data['bundleHash']);
        }
        if (\array_key_exists('contentHash', $data)) {
            $object->setContentHash($data['contentHash']);
        }
        if (\array_key_exists('byteSize', $data)) {
            $object->setByteSize($data['byteSize']);
        }
        if (\array_key_exists('capabilities', $data)) {
            $values = [];
            foreach ($data['capabilities'] as $value) {
                $values[] = $value;
            }
            $object->setCapabilities($values);
        }
        if (\array_key_exists('definition', $data)) {
            $object->setDefinition($data['definition']);
        }
        if (\array_key_exists('manifest', $data)) {
            $object->setManifest($data['manifest']);
        }
        if (\array_key_exists('hasPanel', $data)) {
            $object->setHasPanel($data['hasPanel']);
        }
        if (\array_key_exists('hasIcon', $data)) {
            $object->setHasIcon($data['hasIcon']);
        }
        if (\array_key_exists('hasReadme', $data)) {
            $object->setHasReadme($data['hasReadme']);
        }
        if (\array_key_exists('hasAgentGuide', $data)) {
            $object->setHasAgentGuide($data['hasAgentGuide']);
        }
        if (\array_key_exists('thumbnailStates', $data)) {
            $values_1 = [];
            foreach ($data['thumbnailStates'] as $value_1) {
                $values_1[] = $value_1;
            }
            $object->setThumbnailStates($values_1);
        }
        if (\array_key_exists('warnings', $data)) {
            $values_2 = [];
            foreach ($data['warnings'] as $value_2) {
                $values_2[] = $value_2;
            }
            $object->setWarnings($values_2);
        }
        if (\array_key_exists('conformance', $data)) {
            $object->setConformance($this->denormalizer->denormalize($data['conformance'], \Voidhash\Generated\Core\Model\ComponentConformanceResult::class, 'json', $context));
        }
        if (\array_key_exists('installCount', $data)) {
            $object->setInstallCount($data['installCount']);
        }
        if (\array_key_exists('publishedPaywallCount', $data)) {
            $object->setPublishedPaywallCount($data['publishedPaywallCount']);
        }
        if (\array_key_exists('createdBy', $data)) {
            $object->setCreatedBy($data['createdBy']);
        }
        if (\array_key_exists('publishedAt', $data)) {
            $object->setPublishedAt($data['publishedAt']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['registryComponentId'] = $data->getRegistryComponentId();
        $dataArray['version'] = $data->getVersion();
        $dataArray['number'] = $data->getNumber();
        $dataArray['status'] = $data->getStatus();
        $dataArray['statusMessage'] = $data->getStatusMessage();
        $dataArray['bundleHash'] = $data->getBundleHash();
        $dataArray['contentHash'] = $data->getContentHash();
        $dataArray['byteSize'] = $data->getByteSize();
        $values = [];
        foreach ($data->getCapabilities() as $value) {
            $values[] = $value;
        }
        $dataArray['capabilities'] = $values;
        $dataArray['definition'] = $data->getDefinition();
        $dataArray['manifest'] = $data->getManifest();
        $dataArray['hasPanel'] = $data->getHasPanel();
        $dataArray['hasIcon'] = $data->getHasIcon();
        $dataArray['hasReadme'] = $data->getHasReadme();
        $dataArray['hasAgentGuide'] = $data->getHasAgentGuide();
        $values_1 = [];
        foreach ($data->getThumbnailStates() as $value_1) {
            $values_1[] = $value_1;
        }
        $dataArray['thumbnailStates'] = $values_1;
        $values_2 = [];
        foreach ($data->getWarnings() as $value_2) {
            $values_2[] = $value_2;
        }
        $dataArray['warnings'] = $values_2;
        $dataArray['conformance'] = $this->normalizer->normalize($data->getConformance(), 'json', $context);
        $dataArray['installCount'] = $data->getInstallCount();
        $dataArray['publishedPaywallCount'] = $data->getPublishedPaywallCount();
        $dataArray['createdBy'] = $data->getCreatedBy();
        $dataArray['publishedAt'] = $data->getPublishedAt();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PublishedComponentVersionJsonEncoding::class => false];
    }
}