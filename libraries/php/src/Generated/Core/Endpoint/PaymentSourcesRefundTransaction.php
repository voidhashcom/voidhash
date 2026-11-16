<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaymentSourcesRefundTransaction extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $paymentProviderId;
    protected $externalId;
    /**
     * Asks the source's endpoint to refund a recorded charge, for `amount` or all that is left of it, then records the refund it answers with and returns it, under the source's id for the refund. Fails with `not_found` (`transaction_not_found`) when the charge is not recorded, and with `invalid_request` (`invalid_transaction`) when the refund answered cannot be recorded, which records nothing. Only a payment source records purchases. Fails with `not_found` (`payment_provider_not_found`) for an unknown provider, `invalid_request` (`payment_source_required`) for a store, and `conflict` (`payment_source_disabled`) for a disabled source. Fails with `conflict` (`payment_source_endpoint_not_configured`, `payment_source_endpoint_unsupported` or `payment_source_endpoint_rejected`) when the source's endpoint is not configured, does not support the action or refuses it, and `unavailable` (`payment_source_endpoint_unavailable` or `payment_source_endpoint_invalid_response`) when it does not answer or answers outside the protocol; the message says why.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param string $externalId The payment source's own id for the transaction or subscription; to request a refund, the charge's.
     * @param \Voidhash\Generated\Core\Model\RefundPaymentSourceTransactionBody $requestBody
     */
    public function __construct(string $projectId, string $paymentProviderId, string $externalId, \Voidhash\Generated\Core\Model\RefundPaymentSourceTransactionBody $requestBody)
    {
        $this->projectId = $projectId;
        $this->paymentProviderId = $paymentProviderId;
        $this->externalId = $externalId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{paymentProviderId}', '{externalId}'], [$this->projectId, $this->paymentProviderId, $this->externalId], '/api/v1/projects/{projectId}/payment-providers/{paymentProviderId}/transactions/{externalId}/refund');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\RefundPaymentSourceTransactionBody) {
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
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesRefundTransactionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesRefundTransactionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesRefundTransactionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesRefundTransactionNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesRefundTransactionConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesRefundTransactionInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesRefundTransactionServiceUnavailableException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaymentSourceTransaction
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaymentSourceTransaction', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentSourcesRefundTransactionBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentSourcesRefundTransactionUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentSourcesRefundTransactionForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentSourcesRefundTransactionNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentSourcesRefundTransactionConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentSourcesRefundTransactionInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (503 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentSourcesRefundTransactionServiceUnavailableException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnavailableErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}