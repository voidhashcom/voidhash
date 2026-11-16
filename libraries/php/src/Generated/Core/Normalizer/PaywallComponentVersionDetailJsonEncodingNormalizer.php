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
class PaywallComponentVersionDetailJsonEncodingNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\PaywallComponentVersionDetailJsonEncoding::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\PaywallComponentVersionDetailJsonEncoding::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\PaywallComponentVersionDetailJsonEncoding();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('isDeprecated', $data) && \is_int($data['isDeprecated'])) {
            $data['isDeprecated'] = (bool) $data['isDeprecated'];
        }
        if (\array_key_exists('id', $data)) {
            $object->setId($data['id']);
        }
        if (\array_key_exists('componentId', $data)) {
            $object->setComponentId($data['componentId']);
        }
        if (\array_key_exists('version', $data)) {
            $object->setVersion($data['version']);
        }
        if (\array_key_exists('sourceKind', $data)) {
            $object->setSourceKind($data['sourceKind']);
        }
        if (\array_key_exists('status', $data)) {
            $object->setStatus($data['status']);
        }
        if (\array_key_exists('contentHash', $data) && $data['contentHash'] !== null) {
            $object->setContentHash($data['contentHash']);
        }
        elseif (\array_key_exists('contentHash', $data) && $data['contentHash'] === null) {
            $object->setContentHash(null);
        }
        if (\array_key_exists('panelHash', $data) && $data['panelHash'] !== null) {
            $object->setPanelHash($data['panelHash']);
        }
        elseif (\array_key_exists('panelHash', $data) && $data['panelHash'] === null) {
            $object->setPanelHash(null);
        }
        if (\array_key_exists('byteSize', $data) && $data['byteSize'] !== null) {
            $object->setByteSize($data['byteSize']);
        }
        elseif (\array_key_exists('byteSize', $data) && $data['byteSize'] === null) {
            $object->setByteSize(null);
        }
        if (\array_key_exists('manifest', $data) && $data['manifest'] !== null) {
            $object->setManifest($data['manifest']);
        }
        elseif (\array_key_exists('manifest', $data) && $data['manifest'] === null) {
            $object->setManifest(null);
        }
        if (\array_key_exists('isDeprecated', $data)) {
            $object->setIsDeprecated($data['isDeprecated']);
        }
        if (\array_key_exists('deprecatedAt', $data) && $data['deprecatedAt'] !== null) {
            $object->setDeprecatedAt($data['deprecatedAt']);
        }
        elseif (\array_key_exists('deprecatedAt', $data) && $data['deprecatedAt'] === null) {
            $object->setDeprecatedAt(null);
        }
        if (\array_key_exists('warnings', $data)) {
            $values = [];
            foreach ($data['warnings'] as $value) {
                $values[] = $value;
            }
            $object->setWarnings($values);
        }
        if (\array_key_exists('conformance', $data)) {
            $object->setConformance($this->denormalizer->denormalize($data['conformance'], \Voidhash\Generated\Core\Model\ComponentConformanceResult::class, 'json', $context));
        }
        if (\array_key_exists('createdBy', $data)) {
            $object->setCreatedBy($data['createdBy']);
        }
        if (\array_key_exists('createdAt', $data)) {
            $object->setCreatedAt($data['createdAt']);
        }
        if (\array_key_exists('builtAt', $data) && $data['builtAt'] !== null) {
            $object->setBuiltAt($data['builtAt']);
        }
        elseif (\array_key_exists('builtAt', $data) && $data['builtAt'] === null) {
            $object->setBuiltAt(null);
        }
        if (\array_key_exists('buildLog', $data) && $data['buildLog'] !== null) {
            $object->setBuildLog($data['buildLog']);
        }
        elseif (\array_key_exists('buildLog', $data) && $data['buildLog'] === null) {
            $object->setBuildLog(null);
        }
        if (\array_key_exists('sourceFiles', $data) && $data['sourceFiles'] !== null) {
            $values_1 = new \ArrayObject([], \ArrayObject::ARRAY_AS_PROPS);
            foreach ($data['sourceFiles'] as $key => $value_1) {
                $values_1[$key] = $value_1;
            }
            $object->setSourceFiles($values_1);
        }
        elseif (\array_key_exists('sourceFiles', $data) && $data['sourceFiles'] === null) {
            $object->setSourceFiles(null);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['id'] = $data->getId();
        $dataArray['componentId'] = $data->getComponentId();
        $dataArray['version'] = $data->getVersion();
        $dataArray['sourceKind'] = $data->getSourceKind();
        $dataArray['status'] = $data->getStatus();
        $dataArray['contentHash'] = $data->getContentHash();
        $dataArray['panelHash'] = $data->getPanelHash();
        $dataArray['byteSize'] = $data->getByteSize();
        $dataArray['manifest'] = $data->getManifest();
        $dataArray['isDeprecated'] = $data->getIsDeprecated();
        $dataArray['deprecatedAt'] = $data->getDeprecatedAt();
        $values = [];
        foreach ($data->getWarnings() as $value) {
            $values[] = $value;
        }
        $dataArray['warnings'] = $values;
        $dataArray['conformance'] = $this->normalizer->normalize($data->getConformance(), 'json', $context);
        $dataArray['createdBy'] = $data->getCreatedBy();
        $dataArray['createdAt'] = $data->getCreatedAt();
        $dataArray['builtAt'] = $data->getBuiltAt();
        $dataArray['buildLog'] = $data->getBuildLog();
        $values_1 = [];
        foreach ($data->getSourceFiles() as $key => $value_1) {
            $values_1[$key] = $value_1;
        }
        $dataArray['sourceFiles'] = $values_1;
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\PaywallComponentVersionDetailJsonEncoding::class => false];
    }
}