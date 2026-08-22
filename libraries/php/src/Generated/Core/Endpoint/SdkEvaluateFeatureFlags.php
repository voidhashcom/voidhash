<?php

namespace Voidhash\Generated\Core\Endpoint;

class SdkEvaluateFeatureFlags extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    /**
     * @param \Voidhash\Generated\Core\Model\EvaluateFeatureFlagsBodyJsonEncoding $requestBody
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
    public function __construct(\Voidhash\Generated\Core\Model\EvaluateFeatureFlagsBodyJsonEncoding $requestBody, array $headerParameters = [])
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
        return '/api/v1/sdk/evaluate-flags';
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\EvaluateFeatureFlagsBodyJsonEncoding) {
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
        $optionsResolver->addAllowedTypes('x-client-locale', ['string', 'null']);
        $optionsResolver->addAllowedTypes('x-client-version', ['string', 'null']);
        $optionsResolver->addAllowedTypes('x-is-backgrounded', ['string']);
        $optionsResolver->addAllowedTypes('x-is-debug-build', ['string']);
        $optionsResolver->addAllowedTypes('x-nonce', ['string', 'null']);
        $optionsResolver->addAllowedTypes('x-observer-mode', ['string']);
        $optionsResolver->addAllowedTypes('x-platform', ['string']);
        $optionsResolver->addAllowedTypes('x-platform-brand', ['string', 'null']);
        $optionsResolver->addAllowedTypes('x-platform-device', ['string', 'null']);
        $optionsResolver->addAllowedTypes('x-platform-flavor', ['string']);
        $optionsResolver->addAllowedTypes('x-platform-flavor-version', ['string', 'null']);
        $optionsResolver->addAllowedTypes('x-platform-version', ['string', 'null']);
        $optionsResolver->addAllowedTypes('x-preferred-locales', ['string', 'null']);
        $optionsResolver->addAllowedTypes('x-sdk', ['string']);
        $optionsResolver->addAllowedTypes('x-sdk-version', ['string']);
        $optionsResolver->addAllowedTypes('x-storefront', ['string', 'null']);
        $optionsResolver->addAllowedTypes('x-environment', ['string', 'null']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\SdkEvaluateFeatureFlagsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkEvaluateFeatureFlagsInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\SdkFeatureFlagsResponseJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\SdkFeatureFlagsResponseJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\SdkEvaluateFeatureFlagsUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiNotAuthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\SdkEvaluateFeatureFlagsInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}