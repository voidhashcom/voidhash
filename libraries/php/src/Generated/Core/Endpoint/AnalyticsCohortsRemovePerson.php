<?php

namespace Voidhash\Generated\Core\Endpoint;

class AnalyticsCohortsRemovePerson extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $cohortId;
    protected $personId;
    /**
     * Takes a person out of a static cohort; a person who isn't in it changes nothing. Fails with `invalid_request` (`invalid_analytics_cohort`) for a dynamic cohort.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $cohortId The cohort's id, `an_cohort_...`.
     * @param string $personId The person's id, `person_...`.
     */
    public function __construct(string $projectId, string $cohortId, string $personId)
    {
        $this->projectId = $projectId;
        $this->cohortId = $cohortId;
        $this->personId = $personId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'DELETE';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{cohortId}', '{personId}'], [$this->projectId, $this->cohortId, $this->personId], '/api/v1/projects/{projectId}/analytics/cohorts/{cohortId}/people/{personId}');
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
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsRemovePersonBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsRemovePersonUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsRemovePersonForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsRemovePersonNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsRemovePersonInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsCohortsRemovePersonServiceUnavailableException
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
            throw new \Voidhash\Generated\Core\Exception\AnalyticsCohortsRemovePersonBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsCohortsRemovePersonUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsCohortsRemovePersonForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsCohortsRemovePersonNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsCohortsRemovePersonInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (503 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsCohortsRemovePersonServiceUnavailableException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnavailableErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}