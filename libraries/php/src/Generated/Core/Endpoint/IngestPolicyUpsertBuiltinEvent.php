<?php

namespace Voidhash\Generated\Core\Endpoint;

class IngestPolicyUpsertBuiltinEvent extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $key;
    /**
     * Turns storing a built-in event on or off. Fails with `not_found` (`builtin_event_not_found`) for a `key` that names no built-in event setting.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $key The built-in event setting's key: a built-in event's name, such as `$screen`, or `revenue` for the revenue events.
     * @param \Voidhash\Generated\Core\Model\UpsertBuiltinEventBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, string $key, \Voidhash\Generated\Core\Model\UpsertBuiltinEventBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->key = $key;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PUT';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{key}'], [$this->projectId, $this->key], '/api/v1/projects/{projectId}/ingest-policy/builtin-events/{key}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpsertBuiltinEventBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyUpsertBuiltinEventBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyUpsertBuiltinEventUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyUpsertBuiltinEventForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyUpsertBuiltinEventNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyUpsertBuiltinEventInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\BuiltinEventSettingJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\BuiltinEventSettingJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\IngestPolicyUpsertBuiltinEventBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\IngestPolicyUpsertBuiltinEventUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\IngestPolicyUpsertBuiltinEventForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\IngestPolicyUpsertBuiltinEventNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\IngestPolicyUpsertBuiltinEventInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}