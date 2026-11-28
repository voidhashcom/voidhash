<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaymentProviderHistoryImportsAddIdentifiers extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $paymentProviderId;
    protected $importId;
    /**
     * Adds up to 1,000 purchases to an import that is still `collecting`: to an App Store import by one of their transaction ids (`transactionId`), to a Google Play import by their purchase token (`purchaseToken`), each with your id for its buyer if you have it. The import looks them up as they arrive, at a pace that leaves most of the store's API quota to your app's live traffic. Adding the same purchase again changes nothing. Fails with `invalid_request` (`history_import_identifier_mismatch`) for an identifier of the other store, with `conflict` (`history_import_closed`) once the import was concluded or ended, with `conflict` (`history_import_identifier_limit`) past 100,000 per import, and with `invalid_request` (`history_import_unsupported`) for an import of another provider.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paymentProviderId The id of the project's payment provider connection, `pp_conf_...`.
     * @param string $importId The import's id, `pp_import_...`.
     * @param \Voidhash\Generated\Core\Model\AddStoreImportIdentifiersBody $requestBody
     */
    public function __construct(string $projectId, string $paymentProviderId, string $importId, \Voidhash\Generated\Core\Model\AddStoreImportIdentifiersBody $requestBody)
    {
        $this->projectId = $projectId;
        $this->paymentProviderId = $paymentProviderId;
        $this->importId = $importId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PUT';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{paymentProviderId}', '{importId}'], [$this->projectId, $this->paymentProviderId, $this->importId], '/api/v1/projects/{projectId}/payment-providers/{paymentProviderId}/imports/{importId}/identifiers');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\AddStoreImportIdentifiersBody) {
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
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsAddIdentifiersBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsAddIdentifiersUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsAddIdentifiersForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsAddIdentifiersNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsAddIdentifiersConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsAddIdentifiersInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaymentProviderHistoryImport
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaymentProviderHistoryImport', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsAddIdentifiersBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsAddIdentifiersUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsAddIdentifiersForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsAddIdentifiersNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsAddIdentifiersConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaymentProviderHistoryImportsAddIdentifiersInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}