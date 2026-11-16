<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaymentSourcesUpsertSubscription extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $paymentProviderId;
    protected $externalId;
    /**
     * Records the latest state of a subscription the payment source manages, under the source's own id for it. Idempotent on `externalId` and ordered by `updatedAt`: a state older than the recorded one is `superseded` and changes nothing. Fails with `invalid_request` (`invalid_subscription`) for a state that cannot be recorded as sent. Only a payment source records purchases. Fails with `not_found` (`payment_provider_not_found`) for an unknown provider, `invalid_request` (`payment_source_required`) for a store, and `conflict` (`payment_source_disabled`) for a disabled source.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param string $externalId The payment source's own id for the transaction or subscription; to request a refund, the charge's.
     * @param \Voidhash\Generated\Core\Model\RecordPaymentSourceSubscriptionBody $requestBody
     */
    public function __construct(string $projectId, string $paymentProviderId, string $externalId, \Voidhash\Generated\Core\Model\RecordPaymentSourceSubscriptionBody $requestBody)
    {
        $this->projectId = $projectId;
        $this->paymentProviderId = $paymentProviderId;
        $this->externalId = $externalId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PUT';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{paymentProviderId}', '{externalId}'], [$this->projectId, $this->paymentProviderId, $this->externalId], '/api/v1/projects/{projectId}/payment-providers/{paymentProviderId}/subscriptions/{externalId}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\RecordPaymentSourceSubscriptionBody) {
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
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertSubscriptionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertSubscriptionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertSubscriptionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertSubscriptionNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertSubscriptionConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertSubscriptionInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaymentSourceSubscription
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaymentSourceSubscription', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertSubscriptionBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertSubscriptionUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertSubscriptionForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertSubscriptionNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertSubscriptionConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentSourcesUpsertSubscriptionInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}