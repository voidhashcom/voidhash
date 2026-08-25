<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaymentProviderConfigurationsUpdatePaymentProviderConfiguration extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $configurationId;
    /**
     * @param string $configurationId
     * @param \Voidhash\Generated\Core\Model\UpdatePaymentProviderConfigurationBody $requestBody
     */
    public function __construct(string $configurationId, \Voidhash\Generated\Core\Model\UpdatePaymentProviderConfigurationBody $requestBody)
    {
        $this->configurationId = $configurationId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PATCH';
    }
    public function getUri(): string
    {
        return str_replace(['{configurationId}'], [$this->configurationId], '/api/v1/payment-provider-configurations/{configurationId}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpdatePaymentProviderConfigurationBody) {
            return [['Content-Type' => ['application/json']], $serializer->serialize($this->body, 'json')];
        }
        return [[], null];
    }
    public function getExtraHeaders(): array
    {
        return ['Accept' => ['application/json']];
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsUpdatePaymentProviderConfigurationBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsUpdatePaymentProviderConfigurationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsUpdatePaymentProviderConfigurationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsUpdatePaymentProviderConfigurationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsUpdatePaymentProviderConfigurationInternalServerErrorException
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
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsUpdatePaymentProviderConfigurationBadRequestException($response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsUpdatePaymentProviderConfigurationUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsUpdatePaymentProviderConfigurationForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsUpdatePaymentProviderConfigurationNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsUpdatePaymentProviderConfigurationInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}