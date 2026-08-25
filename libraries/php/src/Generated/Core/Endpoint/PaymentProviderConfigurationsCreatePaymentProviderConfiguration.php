<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaymentProviderConfigurationsCreatePaymentProviderConfiguration extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    /**
     * @param \Voidhash\Generated\Core\Model\CreatePaymentProviderConfigurationBody $requestBody
     */
    public function __construct(\Voidhash\Generated\Core\Model\CreatePaymentProviderConfigurationBody $requestBody)
    {
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return '/api/v1/payment-provider-configurations';
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\CreatePaymentProviderConfigurationBody) {
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
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsCreatePaymentProviderConfigurationBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsCreatePaymentProviderConfigurationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsCreatePaymentProviderConfigurationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsCreatePaymentProviderConfigurationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsCreatePaymentProviderConfigurationConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsCreatePaymentProviderConfigurationInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\ApiV1PaymentProviderConfigurationsPostResponse201
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (201 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiV1PaymentProviderConfigurationsPostResponse201', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsCreatePaymentProviderConfigurationBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationValidationErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsCreatePaymentProviderConfigurationUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsCreatePaymentProviderConfigurationForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsCreatePaymentProviderConfigurationNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaymentProviderConfigurationNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsCreatePaymentProviderConfigurationConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaymentProviderAlreadyExistsErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsCreatePaymentProviderConfigurationInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}