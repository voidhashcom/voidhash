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
        
        \Voidhash\Generated\EventCapture\Model\CaptureAcceptedResponse::class => \Voidhash\Generated\EventCapture\Normalizer\CaptureAcceptedResponseNormalizer::class,
        
        \Voidhash\Generated\EventCapture\Model\CaptureInvalidRequestError::class => \Voidhash\Generated\EventCapture\Normalizer\CaptureInvalidRequestErrorNormalizer::class,
        
        \Voidhash\Generated\EventCapture\Model\EffectHttpApiSchemaError::class => \Voidhash\Generated\EventCapture\Normalizer\EffectHttpApiSchemaErrorNormalizer::class,
        
        \Voidhash\Generated\EventCapture\Model\CaptureUnauthorizedError::class => \Voidhash\Generated\EventCapture\Normalizer\CaptureUnauthorizedErrorNormalizer::class,
        
        \Voidhash\Generated\EventCapture\Model\CapturePayloadTooLargeError::class => \Voidhash\Generated\EventCapture\Normalizer\CapturePayloadTooLargeErrorNormalizer::class,
        
        \Voidhash\Generated\EventCapture\Model\CaptureRateLimitedError::class => \Voidhash\Generated\EventCapture\Normalizer\CaptureRateLimitedErrorNormalizer::class,
        
        \Voidhash\Generated\EventCapture\Model\CaptureDependencyUnavailableError::class => \Voidhash\Generated\EventCapture\Normalizer\CaptureDependencyUnavailableErrorNormalizer::class,
        
        \Voidhash\Generated\EventCapture\Model\CaptureInternalServerError::class => \Voidhash\Generated\EventCapture\Normalizer\CaptureInternalServerErrorNormalizer::class,
        
        \Voidhash\Generated\EventCapture\Model\IV1CapturePostBody::class => \Voidhash\Generated\EventCapture\Normalizer\IV1CapturePostBodyNormalizer::class,
        
        \Voidhash\Generated\EventCapture\Model\IV1BatchPostBody::class => \Voidhash\Generated\EventCapture\Normalizer\IV1BatchPostBodyNormalizer::class,
        
        \Voidhash\Generated\EventCapture\Model\IV1BatchPostBodyEventsItem::class => \Voidhash\Generated\EventCapture\Normalizer\IV1BatchPostBodyEventsItemNormalizer::class,
        
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
            
            \Voidhash\Generated\EventCapture\Model\CaptureAcceptedResponse::class => false,
            \Voidhash\Generated\EventCapture\Model\CaptureInvalidRequestError::class => false,
            \Voidhash\Generated\EventCapture\Model\EffectHttpApiSchemaError::class => false,
            \Voidhash\Generated\EventCapture\Model\CaptureUnauthorizedError::class => false,
            \Voidhash\Generated\EventCapture\Model\CapturePayloadTooLargeError::class => false,
            \Voidhash\Generated\EventCapture\Model\CaptureRateLimitedError::class => false,
            \Voidhash\Generated\EventCapture\Model\CaptureDependencyUnavailableError::class => false,
            \Voidhash\Generated\EventCapture\Model\CaptureInternalServerError::class => false,
            \Voidhash\Generated\EventCapture\Model\IV1CapturePostBody::class => false,
            \Voidhash\Generated\EventCapture\Model\IV1BatchPostBody::class => false,
            \Voidhash\Generated\EventCapture\Model\IV1BatchPostBodyEventsItem::class => false,
            \Jane\Component\JsonSchemaRuntime\Reference::class => false,
        ];
    }
}