<?php

namespace Voidhash\Generated\Core\Endpoint;

class AnalyticsGroupsDelete extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $groupId;
    /**
     * Deletes a group and its properties. Its events stay, still naming its key.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $groupId The group's id, `an_group_...`.
     */
    public function __construct(string $projectId, string $groupId)
    {
        $this->projectId = $projectId;
        $this->groupId = $groupId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'DELETE';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{groupId}'], [$this->projectId, $this->groupId], '/api/v1/projects/{projectId}/analytics/groups/{groupId}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        return [[], null];
    }
    public function getExtraHeaders(): array
    {
        return ['Accept' => ['application/json']];
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsDeleteInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupsDeleteServiceUnavailableException
     *
     * @return null
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (204 === $status) {
            return null;
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsGroupsDeleteBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsGroupsDeleteUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsGroupsDeleteForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsGroupsDeleteNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsGroupsDeleteInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (503 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsGroupsDeleteServiceUnavailableException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnavailableErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}