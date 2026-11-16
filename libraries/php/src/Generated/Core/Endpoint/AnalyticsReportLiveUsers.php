<?php

namespace Voidhash\Generated\Core\Endpoint;

class AnalyticsReportLiveUsers extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    /**
     * Who is here now: the people who opened or returned to the project's apps (`$app_opened`, `$app_became_active`), and the people who viewed one of its web pages (`$pageview`), within the last `windowMinutes`. Someone on both counts once in each. `locations` places people in whole degrees of latitude and longitude, the coarseness of a region; `users` also counts people whose events carry no location, so it can exceed the sum of `locations`. Reads production events unless the credential names another environment, as for insights. On a self-hosted server, these events count only after they are turned on in the project's ingest policy. Takes no options.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     */
    public function __construct(string $projectId)
    {
        $this->projectId = $projectId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}'], [$this->projectId], '/api/v1/projects/{projectId}/analytics/reports/live-users');
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
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportLiveUsersBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportLiveUsersUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportLiveUsersForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportLiveUsersNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportLiveUsersInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\LiveUsersResultJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\LiveUsersResultJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsReportLiveUsersBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsReportLiveUsersUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsReportLiveUsersForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsReportLiveUsersNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsReportLiveUsersInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}