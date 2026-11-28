<?php

namespace Voidhash\Generated\Core\Endpoint;

class PersonsCreateGrant extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $personId;
    /**
     * Grants the person a perk without a purchase, for support cases, testers or compensation, until `expiresAt` or for life. The person can use the perk while the grant or any purchase of it is active; the SDKs report it with the source `manual`. It carries no revenue. A secret key grants in its own environment; a person's own credentials grant in `production`, or in `test` with `x-environment: test`. Repeating the request with the same `Idempotency-Key` header answers the first grant. Fails with `not_found` (`person_not_found`) for an unknown or erased person and `not_found` (`perk_not_found`) for a perk the project does not have. Fails with `conflict` (`grant_already_active`) while the person has an active grant of the perk in the environment; revoke it first to change it. Fails with `conflict` (`idempotency_key_reused`) for a key already used for another person or perk, `invalid_request` (`grant_expiry_past`) for an `expiresAt` that has passed, and `invalid_request` (`grant_environment_required`) with `x-environment: all`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $personId The person's id, `person_...`. The id of a person merged into another names the person they were merged into.
     * @param \Voidhash\Generated\Core\Model\CreatePersonGrantBodyJsonEncoding $requestBody
     * @param array{
     *    "idempotency-key"?: string, //Names this grant, so sending the request again answers the grant it made instead of granting again. Keys are kept per project.
     * } $headerParameters
     */
    public function __construct(string $projectId, string $personId, \Voidhash\Generated\Core\Model\CreatePersonGrantBodyJsonEncoding $requestBody, array $headerParameters = [])
    {
        $this->projectId = $projectId;
        $this->personId = $personId;
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
        return str_replace(['{projectId}', '{personId}'], [$this->projectId, $this->personId], '/api/v1/projects/{projectId}/persons/{personId}/grants');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\CreatePersonGrantBodyJsonEncoding) {
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
        $optionsResolver->setDefined(['idempotency-key']);
        $optionsResolver->setRequired([]);
        $optionsResolver->setDefaults([]);
        $optionsResolver->addAllowedTypes('idempotency-key', ['string']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreateGrantBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreateGrantUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreateGrantForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreateGrantNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreateGrantConflictException
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreateGrantInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PersonGrantJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (201 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PersonGrantJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PersonsCreateGrantBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PersonsCreateGrantUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PersonsCreateGrantForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PersonsCreateGrantNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PersonsCreateGrantConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PersonsCreateGrantInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}