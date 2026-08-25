<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaymentProviderConfigurationsGetPaymentProviderConfiguration extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $configurationId;
    /**
     * @param string $configurationId
     */
    public function __construct(string $configurationId)
    {
        $this->configurationId = $configurationId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{configurationId}'], [$this->configurationId], '/api/v1/payment-provider-configurations/{configurationId}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        return [[], null];
    }
    public function getExtraHeaders(): array
    {
        return ['Accept' => ['application/json']];
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsGetPaymentProviderConfigurationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsGetPaymentProviderConfigurationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsGetPaymentProviderConfigurationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsGetPaymentProviderConfigurationInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaymentProviderConfigurationSummary
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaymentProviderConfigurationSummary', 'json');
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsGetPaymentProviderConfigurationUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsGetPaymentProviderConfigurationForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsGetPaymentProviderConfigurationNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsGetPaymentProviderConfigurationInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}