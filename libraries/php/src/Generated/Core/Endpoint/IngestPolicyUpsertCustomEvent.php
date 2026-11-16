<?php

namespace Voidhash\Generated\Core\Endpoint;

class IngestPolicyUpsertCustomEvent extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $eventName;
    /**
     * Blocks or unblocks storing a custom event, named URL-encoded in the path. Fails with `invalid_request` (`reserved_event_name`) for a blank or `$`-prefixed name; built-in events are turned on and off by their setting instead.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $eventName The custom event's name, URL-encoded. Surrounding spaces are trimmed.
     * @param \Voidhash\Generated\Core\Model\UpsertCustomEventBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, string $eventName, \Voidhash\Generated\Core\Model\UpsertCustomEventBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->eventName = $eventName;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PUT';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{eventName}'], [$this->projectId, $this->eventName], '/api/v1/projects/{projectId}/ingest-policy/custom-events/{eventName}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpsertCustomEventBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyUpsertCustomEventBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyUpsertCustomEventUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyUpsertCustomEventForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyUpsertCustomEventNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyUpsertCustomEventInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\CustomEventSettingJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\CustomEventSettingJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\IngestPolicyUpsertCustomEventBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\IngestPolicyUpsertCustomEventUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\IngestPolicyUpsertCustomEventForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\IngestPolicyUpsertCustomEventNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\IngestPolicyUpsertCustomEventInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}