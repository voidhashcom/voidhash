<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaymentProvidersTest extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $paymentProviderId;
    /**
     * Sends a signed `describe` request to a payment source's endpoint and returns the operations it implements. Changes nothing. `environment=test` sends a test request to the endpoint test requests go to: the `testEndpoint`, or the `endpoint` of a source without one. By default a production request tests the `endpoint`; production requests never go to the `testEndpoint`. Only a payment source can be tested. Fails with `invalid_request` (`payment_source_required`) for a store. Fails with `conflict` (`payment_source_endpoint_not_configured`) for a source without an endpoint for the environment, `conflict` (`payment_source_endpoint_rejected`) when the endpoint refuses the request, and `unavailable` (`payment_source_endpoint_unavailable` or `payment_source_endpoint_invalid_response`) when it does not answer or answers outside the protocol. The message says what to fix.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param array{
     *    "environment"?: string, //Which endpoint to test: `production`, the default, tests `endpoint`; `test` tests `testEndpoint`, or `endpoint` when there is none.
     * } $queryParameters
     */
    public function __construct(string $projectId, string $paymentProviderId, array $queryParameters = [])
    {
        $this->projectId = $projectId;
        $this->paymentProviderId = $paymentProviderId;
        $this->queryParameters = $queryParameters;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{paymentProviderId}'], [$this->projectId, $this->paymentProviderId], '/api/v1/projects/{projectId}/payment-providers/{paymentProviderId}/test');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        return [[], null];
    }
    public function getExtraHeaders(): array
    {
        return ['Accept' => ['application/json']];
    }
    protected function getQueryOptionsResolver(): \Symfony\Component\OptionsResolver\OptionsResolver
    {
        $optionsResolver = parent::getQueryOptionsResolver();
        $optionsResolver->setDefined(['environment']);
        $optionsResolver->setRequired([]);
        $optionsResolver->setDefaults([]);
        $optionsResolver->addAllowedTypes('environment', ['string']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersTestBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersTestUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersTestForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersTestNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersTestConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersTestInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProvidersTestServiceUnavailableException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaymentSourceEndpointDescription
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaymentSourceEndpointDescription', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProvidersTestBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProvidersTestUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProvidersTestForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProvidersTestNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProvidersTestConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProvidersTestInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (503 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProvidersTestServiceUnavailableException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnavailableErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}