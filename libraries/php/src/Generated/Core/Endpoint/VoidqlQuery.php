<?php

namespace Voidhash\Generated\Core\Endpoint;

class VoidqlQuery extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    /**
     * Runs one read-only VoidQL `SELECT` over the project and returns up to `limit` rows (100 by default, at most 10,000) with `isTruncated` when there were more. `getSchema` lists the tables and their columns. Running a query changes nothing, so it is safe to repeat. Personal data (people's email, name and traits, and event keys that identify a person, such as `properties.$email` or `context.$ip`) needs the `project:persons:read` permission as well. A query runs for at most 20 seconds. Fails with `invalid_request` (`voidql_syntax`, `voidql_unsupported`, `voidql_unknown_relation`, `voidql_unknown_field`, `voidql_too_complex` or `voidql_rejected`) with a message saying what to change, where `param` names the field of an unknown one and a rejection names the database's error code; `permission_denied` (`personal_data`) for personal data without the permission; `rate_limited` (`voidql_quota`) when the organization runs too many queries; and `unavailable` (`voidql_timeout`, `voidql_memory` or `voidql_unavailable`) when the query could not finish.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\VoidQlQueryBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, \Voidhash\Generated\Core\Model\VoidQlQueryBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}'], [$this->projectId], '/api/v1/projects/{projectId}/analytics/voidql/query');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\VoidQlQueryBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\VoidqlQueryBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlQueryUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlQueryForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlQueryNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlQueryTooManyRequestsException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlQueryInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\VoidqlQueryServiceUnavailableException
     *
     * @return null|\Voidhash\Generated\Core\Model\VoidQlQueryResultJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\VoidQlQueryResultJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\VoidqlQueryBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\VoidqlQueryUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\VoidqlQueryForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\VoidqlQueryNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (429 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\VoidqlQueryTooManyRequestsException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\RateLimitedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\VoidqlQueryInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (503 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\VoidqlQueryServiceUnavailableException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnavailableErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}