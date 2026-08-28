<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaymentProviderConfigurationsDeletePaymentProviderConfiguration extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
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
        return 'DELETE';
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
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsDeletePaymentProviderConfigurationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsDeletePaymentProviderConfigurationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsDeletePaymentProviderConfigurationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsDeletePaymentProviderConfigurationConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsDeletePaymentProviderConfigurationInternalServerErrorException
     *
     * @return null
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (204 === $status) {
            return null;
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsDeletePaymentProviderConfigurationUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsDeletePaymentProviderConfigurationForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsDeletePaymentProviderConfigurationNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsDeletePaymentProviderConfigurationConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationInUseErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsDeletePaymentProviderConfigurationInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}