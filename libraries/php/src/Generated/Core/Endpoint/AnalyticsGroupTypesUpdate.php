<?php

namespace Voidhash\Generated\Core\Endpoint;

class AnalyticsGroupTypesUpdate extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $groupTypeId;
    /**
     * Names a group type as Studio shows it, such as `Team` and `Teams` for `company`. Its key never changes. Fails with `not_found` (`analytics_group_type_not_found`) when the project has no such group type.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $groupTypeId The group type's id, `an_group_type_...`.
     * @param \Voidhash\Generated\Core\Model\UpdateAnalyticsGroupTypeBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, string $groupTypeId, \Voidhash\Generated\Core\Model\UpdateAnalyticsGroupTypeBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->groupTypeId = $groupTypeId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PATCH';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{groupTypeId}'], [$this->projectId, $this->groupTypeId], '/api/v1/projects/{projectId}/analytics/group-types/{groupTypeId}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpdateAnalyticsGroupTypeBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesUpdateInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesUpdateServiceUnavailableException
     *
     * @return null|\Voidhash\Generated\Core\Model\AnalyticsGroupTypeJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\AnalyticsGroupTypeJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesUpdateBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesUpdateUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesUpdateForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesUpdateNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesUpdateInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (503 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsGroupTypesUpdateServiceUnavailableException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnavailableErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}