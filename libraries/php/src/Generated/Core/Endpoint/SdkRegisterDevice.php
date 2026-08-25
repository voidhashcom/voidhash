<?php

namespace Voidhash\Generated\Core\Endpoint;

class SdkRegisterDevice extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    /**
     * @param \Voidhash\Generated\Core\Model\RegisterDeviceBodyJsonEncoding $requestBody
     * @param array{
     *    "x-distinct-id": string,
     *    "x-publishable-key": string,
     *    "x-client-bundle-id": string,
     *    "x-client-locale"?: string,
     *    "x-client-version"?: string,
     *    "x-is-backgrounded": string,
     *    "x-is-debug-build": string,
     *    "x-nonce"?: string,
     *    "x-observer-mode": string,
     *    "x-platform": string,
     *    "x-platform-brand"?: string,
     *    "x-platform-device"?: string,
     *    "x-platform-flavor": string,
     *    "x-platform-flavor-version"?: string,
     *    "x-platform-version"?: string,
     *    "x-preferred-locales"?: string,
     *    "x-sdk": string,
     *    "x-sdk-version": string,
     *    "x-storefront"?: string,
     *    "x-environment"?: string,
     * } $headerParameters
     */
    public function __construct(\Voidhash\Generated\Core\Model\RegisterDeviceBodyJsonEncoding $requestBody, array $headerParameters = [])
    {
        $this->body = $requestBody;
        $this->headerParameters = $headerParameters;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return '/api/v1/sdk/push-devices/register';
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\RegisterDeviceBodyJsonEncoding) {
            return [['Content-Type' => ['application/json']], $serializer->serialize($this->body, 'json')];
        }
        return [[], null];
    }
    public function getExtraHeaders(): array
    {
        return ['Accept' => ['application/json']];
    }
    protected function getHeadersOptionsResolver(): \Symfony\Component\OptionsResolver\OptionsResolver
    {
        $optionsResolver = parent::getHeadersOptionsResolver();
        $optionsResolver->setDefined(['x-distinct-id', 'x-publishable-key', 'x-client-bundle-id', 'x-client-locale', 'x-client-version', 'x-is-backgrounded', 'x-is-debug-build', 'x-nonce', 'x-observer-mode', 'x-platform', 'x-platform-brand', 'x-platform-device', 'x-platform-flavor', 'x-platform-flavor-version', 'x-platform-version', 'x-preferred-locales', 'x-sdk', 'x-sdk-version', 'x-storefront', 'x-environment']);
        $optionsResolver->setRequired(['x-distinct-id', 'x-publishable-key', 'x-client-bundle-id', 'x-is-backgrounded', 'x-is-debug-build', 'x-observer-mode', 'x-platform', 'x-platform-flavor', 'x-sdk', 'x-sdk-version']);
        $optionsResolver->setDefaults([]);
        $optionsResolver->addAllowedTypes('x-distinct-id', ['string']);
        $optionsResolver->addAllowedTypes('x-publishable-key', ['string']);
        $optionsResolver->addAllowedTypes('x-client-bundle-id', ['string']);
        $optionsResolver->addAllowedTypes('x-client-locale', ['string']);
        $optionsResolver->addAllowedTypes('x-client-version', ['string']);
        $optionsResolver->addAllowedTypes('x-is-backgrounded', ['string']);
        $optionsResolver->addAllowedTypes('x-is-debug-build', ['string']);
        $optionsResolver->addAllowedTypes('x-nonce', ['string']);
        $optionsResolver->addAllowedTypes('x-observer-mode', ['string']);
        $optionsResolver->addAllowedTypes('x-platform', ['string']);
        $optionsResolver->addAllowedTypes('x-platform-brand', ['string']);
        $optionsResolver->addAllowedTypes('x-platform-device', ['string']);
        $optionsResolver->addAllowedTypes('x-platform-flavor', ['string']);
        $optionsResolver->addAllowedTypes('x-platform-flavor-version', ['string']);
        $optionsResolver->addAllowedTypes('x-platform-version', ['string']);
        $optionsResolver->addAllowedTypes('x-preferred-locales', ['string']);
        $optionsResolver->addAllowedTypes('x-sdk', ['string']);
        $optionsResolver->addAllowedTypes('x-sdk-version', ['string']);
        $optionsResolver->addAllowedTypes('x-storefront', ['string']);
        $optionsResolver->addAllowedTypes('x-environment', ['string']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\SdkRegisterDeviceBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkRegisterDeviceUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkRegisterDeviceForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SdkRegisterDeviceNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SdkRegisterDeviceInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\RegisterDeviceResponseJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\RegisterDeviceResponseJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\SdkRegisterDeviceBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPushDeviceValidationErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\SdkRegisterDeviceUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\SdkRegisterDeviceForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\SdkRegisterDeviceNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPushDeviceNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\SdkRegisterDeviceInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}