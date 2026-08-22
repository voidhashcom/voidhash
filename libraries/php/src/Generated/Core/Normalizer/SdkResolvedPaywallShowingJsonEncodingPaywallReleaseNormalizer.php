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
class SdkResolvedPaywallShowingJsonEncodingPaywallReleaseNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return $type === \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywallRelease::class;
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && get_class($data) === \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywallRelease::class;
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $object = new \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywallRelease();
        if (null === $data || false === \is_array($data)) {
            return $object;
        }
        if (isset($data['$ref']) && !isset($data['type']) && !isset($data['properties']) && !isset($data['allOf'])) {
            return new Reference($data['$ref'], $context['document-origin']);
        }
        if (isset($data['$recursiveRef'])) {
            return new Reference($data['$recursiveRef'], $context['document-origin']);
        }
        if (\array_key_exists('htmlUrl', $data)) {
            $object->setHtmlUrl($data['htmlUrl']);
        }
        if (\array_key_exists('publishedAt', $data) && $data['publishedAt'] !== null) {
            $object->setPublishedAt($data['publishedAt']);
        }
        elseif (\array_key_exists('publishedAt', $data) && $data['publishedAt'] === null) {
            $object->setPublishedAt(null);
        }
        if (\array_key_exists('releaseId', $data)) {
            $object->setReleaseId($data['releaseId']);
        }
        if (\array_key_exists('runtime', $data) && $data['runtime'] !== null) {
            $object->setRuntime($this->denormalizer->denormalize($data['runtime'], \Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywallReleaseRuntime::class, 'json', $context));
        }
        elseif (\array_key_exists('runtime', $data) && $data['runtime'] === null) {
            $object->setRuntime(null);
        }
        if (\array_key_exists('version', $data)) {
            $object->setVersion($data['version']);
        }
        return $object;
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $dataArray = [];
        $dataArray['htmlUrl'] = $data->getHtmlUrl();
        $dataArray['publishedAt'] = $data->getPublishedAt();
        $dataArray['releaseId'] = $data->getReleaseId();
        $dataArray['runtime'] = $this->normalizer->normalize($data->getRuntime(), 'json', $context);
        $dataArray['version'] = $data->getVersion();
        return $dataArray;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [\Voidhash\Generated\Core\Model\SdkResolvedPaywallShowingJsonEncodingPaywallRelease::class => false];
    }
}