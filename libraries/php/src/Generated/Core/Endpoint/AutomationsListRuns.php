<?php

namespace Voidhash\Generated\Core\Endpoint;

class AutomationsListRuns extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $automationId;
    /**
     * Lists the automation's runs, newest first, optionally only one person's or those in one `status`. Fails with `invalid_request` (`invalid_cursor`) for a cursor this list did not return.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $automationId The automation's id, `auto_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "personId"?: string, //Only the runs of the person with this id.
     *    "status"?: string, //Only runs in this state. `queued` and `waiting` both match every run that has not moved on yet.
     * } $queryParameters
     */
    public function __construct(string $projectId, string $automationId, array $queryParameters = [])
    {
        $this->projectId = $projectId;
        $this->automationId = $automationId;
        $this->queryParameters = $queryParameters;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{automationId}'], [$this->projectId, $this->automationId], '/api/v1/projects/{projectId}/automations/{automationId}/runs');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        return [[], null];
    }
    public function getExtraHeaders(): array
    {
        return ['Accept' => ['application/json']];
    }
    protected function getQueryOptionsResolver(): \Symfony\Component\OptionsResolver\OptionsResolver
    {
        $optionsResolver = parent::getQueryOptionsResolver();
        $optionsResolver->setDefined(['cursor', 'limit', 'personId', 'status']);
        $optionsResolver->setRequired([]);
        $optionsResolver->setDefaults([]);
        $optionsResolver->addAllowedTypes('cursor', ['string']);
        $optionsResolver->addAllowedTypes('limit', ['int']);
        $optionsResolver->addAllowedTypes('personId', ['string']);
        $optionsResolver->addAllowedTypes('status', ['string']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListRunsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListRunsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListRunsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListRunsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AutomationsListRunsInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAutomationsAutomationIdRunsGetResponse200
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAutomationsAutomationIdRunsGetResponse200', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AutomationsListRunsBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AutomationsListRunsUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AutomationsListRunsForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AutomationsListRunsNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AutomationsListRunsInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}