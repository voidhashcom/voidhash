<?php

namespace Voidhash\Generated\Core\Endpoint;

class ExperimentsStart extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $experimentId;
    /**
     * Starts a draft experiment, or resumes a paused one: each of its paywall locations starts splitting end users between the arms, and each feature flag it sets takes the value of the end user's arm. Fails with `conflict` (`experiment_already_running`, `experiment_concluded` or `experiment_archived`) when the experiment is running, concluded or archived, and `conflict` (`experiment_not_startable`) when a placed paywall has no deployed build, a location runs another experiment, or another running or paused experiment sets one of its flags.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $experimentId The experiment's id, `exp_...`.
     */
    public function __construct(string $projectId, string $experimentId)
    {
        $this->projectId = $projectId;
        $this->experimentId = $experimentId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{experimentId}'], [$this->projectId, $this->experimentId], '/api/v1/projects/{projectId}/experiments/{experimentId}/start');
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
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsStartBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsStartUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsStartForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsStartNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsStartConflictException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsStartInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\ExperimentJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ExperimentJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsStartBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsStartUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsStartForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsStartNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsStartConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsStartInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}