<?php

namespace Voidhash\Generated\EventCapture\Normalizer;

use Voidhash\Generated\EventCapture\Runtime\Normalizer\CheckArray;
use Voidhash\Generated\EventCapture\Runtime\Normalizer\ValidatorTrait;
use Symfony\Component\Serializer\Normalizer\DenormalizerAwareInterface;
use Symfony\Component\Serializer\Normalizer\DenormalizerAwareTrait;
use Symfony\Component\Serializer\Normalizer\DenormalizerInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareTrait;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;
class JaneObjectNormalizer implements DenormalizerInterface, NormalizerInterface, DenormalizerAwareInterface, NormalizerAwareInterface
{
    use DenormalizerAwareTrait;
    use NormalizerAwareTrait;
    use CheckArray;
    use ValidatorTrait;
    protected $normalizers = [
        
        \Voidhash\Generated\EventCapture\Model\CaptureAcceptedResponseJsonEncoding::class => \Voidhash\Generated\EventCapture\Normalizer\CaptureAcceptedResponseJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\EventCapture\Model\CaptureInvalidRequestErrorJsonEncoding::class => \Voidhash\Generated\EventCapture\Normalizer\CaptureInvalidRequestErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\EventCapture\Model\CaptureUnauthorizedErrorJsonEncoding::class => \Voidhash\Generated\EventCapture\Normalizer\CaptureUnauthorizedErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\EventCapture\Model\CapturePayloadTooLargeErrorJsonEncoding::class => \Voidhash\Generated\EventCapture\Normalizer\CapturePayloadTooLargeErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\EventCapture\Model\CaptureRateLimitedErrorJsonEncoding::class => \Voidhash\Generated\EventCapture\Normalizer\CaptureRateLimitedErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\EventCapture\Model\CaptureDependencyUnavailableErrorJsonEncoding::class => \Voidhash\Generated\EventCapture\Normalizer\CaptureDependencyUnavailableErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\EventCapture\Model\CaptureInternalServerErrorJsonEncoding::class => \Voidhash\Generated\EventCapture\Normalizer\CaptureInternalServerErrorJsonEncodingNormalizer::class,
        
        \Voidhash\Generated\EventCapture\Model\CaptureEvent::class => \Voidhash\Generated\EventCapture\Normalizer\CaptureEventNormalizer::class,
        
        \Voidhash\Generated\EventCapture\Model\IV1CapturePostBody::class => \Voidhash\Generated\EventCapture\Normalizer\IV1CapturePostBodyNormalizer::class,
        
        \Voidhash\Generated\EventCapture\Model\IV1BatchPostBody::class => \Voidhash\Generated\EventCapture\Normalizer\IV1BatchPostBodyNormalizer::class,
        
        \Jane\Component\JsonSchemaRuntime\Reference::class => \Voidhash\Generated\EventCapture\Runtime\Normalizer\ReferenceNormalizer::class,
    ], $normalizersCache = [];
    public function supportsDenormalization(mixed $data, string $type, ?string $format = null, array $context = []): bool
    {
        return array_key_exists($type, $this->normalizers);
    }
    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        return is_object($data) && array_key_exists(get_class($data), $this->normalizers);
    }
    public function normalize(mixed $data, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $normalizerClass = $this->normalizers[get_class($data)];
        $normalizer = $this->getNormalizer($normalizerClass);
        return $normalizer->normalize($data, $format, $context);
    }
    public function denormalize(mixed $data, string $type, ?string $format = null, array $context = []): mixed
    {
        $denormalizerClass = $this->normalizers[$type];
        $denormalizer = $this->getNormalizer($denormalizerClass);
        return $denormalizer->denormalize($data, $type, $format, $context);
    }
    private function getNormalizer(string $normalizerClass)
    {
        return $this->normalizersCache[$normalizerClass] ?? $this->initNormalizer($normalizerClass);
    }
    private function initNormalizer(string $normalizerClass)
    {
        $normalizer = new $normalizerClass();
        $normalizer->setNormalizer($this->normalizer);
        $normalizer->setDenormalizer($this->denormalizer);
        $this->normalizersCache[$normalizerClass] = $normalizer;
        return $normalizer;
    }
    public function getSupportedTypes(?string $format = null): array
    {
        return [
            
            \Voidhash\Generated\EventCapture\Model\CaptureAcceptedResponseJsonEncoding::class => false,
            \Voidhash\Generated\EventCapture\Model\CaptureInvalidRequestErrorJsonEncoding::class => false,
            \Voidhash\Generated\EventCapture\Model\CaptureUnauthorizedErrorJsonEncoding::class => false,
            \Voidhash\Generated\EventCapture\Model\CapturePayloadTooLargeErrorJsonEncoding::class => false,
            \Voidhash\Generated\EventCapture\Model\CaptureRateLimitedErrorJsonEncoding::class => false,
            \Voidhash\Generated\EventCapture\Model\CaptureDependencyUnavailableErrorJsonEncoding::class => false,
            \Voidhash\Generated\EventCapture\Model\CaptureInternalServerErrorJsonEncoding::class => false,
            \Voidhash\Generated\EventCapture\Model\CaptureEvent::class => false,
            \Voidhash\Generated\EventCapture\Model\IV1CapturePostBody::class => false,
            \Voidhash\Generated\EventCapture\Model\IV1BatchPostBody::class => false,
            \Jane\Component\JsonSchemaRuntime\Reference::class => false,
        ];
    }
}