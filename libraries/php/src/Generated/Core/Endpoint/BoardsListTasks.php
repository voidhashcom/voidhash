<?php

namespace Voidhash\Generated\Core\Endpoint;

class BoardsListTasks extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $boardId;
    /**
     * Lists a board's tasks in board order, narrowed by column, assignee, label, priority or text. Archived tasks are listed only with `isArchived=true`, and then only they are.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $boardId
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "columnId"?: string,
     *    "assignee"?: string,
     *    "labelId"?: string,
     *    "priority"?: string,
     *    "isArchived"?: string,
     *    "text"?: string,
     * } $queryParameters
     */
    public function __construct(string $projectId, string $boardId, array $queryParameters = [])
    {
        $this->projectId = $projectId;
        $this->boardId = $boardId;
        $this->queryParameters = $queryParameters;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{boardId}'], [$this->projectId, $this->boardId], '/api/v1/projects/{projectId}/boards/{boardId}/tasks');
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
        $optionsResolver->setDefined(['cursor', 'limit', 'columnId', 'assignee', 'labelId', 'priority', 'isArchived', 'text']);
        $optionsResolver->setRequired([]);
        $optionsResolver->setDefaults([]);
        $optionsResolver->addAllowedTypes('cursor', ['string']);
        $optionsResolver->addAllowedTypes('limit', ['int']);
        $optionsResolver->addAllowedTypes('columnId', ['string']);
        $optionsResolver->addAllowedTypes('assignee', ['string']);
        $optionsResolver->addAllowedTypes('labelId', ['string']);
        $optionsResolver->addAllowedTypes('priority', ['string']);
        $optionsResolver->addAllowedTypes('isArchived', ['string']);
        $optionsResolver->addAllowedTypes('text', ['string']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\BoardsListTasksBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\BoardsListTasksUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\BoardsListTasksForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\BoardsListTasksNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\BoardsListTasksInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\BoardsListTasksServiceUnavailableException
     *
     * @return null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdBoardsBoardIdTasksGetResponse200
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdBoardsBoardIdTasksGetResponse200', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\BoardsListTasksBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\BoardsListTasksUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\BoardsListTasksForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\BoardsListTasksNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\BoardsListTasksInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (503 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\BoardsListTasksServiceUnavailableException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnavailableErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}