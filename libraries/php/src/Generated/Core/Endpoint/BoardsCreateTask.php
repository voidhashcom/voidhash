<?php

namespace Voidhash\Generated\Core\Endpoint;

class BoardsCreateTask extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $boardId;
    /**
     * Adds a task to the end of a column, the board's first when `columnId` is left out. Repeating a create with the same `Idempotency-Key` header returns the first task instead of adding another. Keys are kept per project: a key whose task is not on this board (made on another board, or deleted since) fails with `conflict` (`idempotency_key_reused`). Assignees must be members of the project's organization or bots added to the project (`assignee_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $boardId
     * @param \Voidhash\Generated\Core\Model\CreateBoardTaskBodyJsonEncoding $requestBody
     * @param array{
     *    "idempotency-key"?: string,
     * } $headerParameters
     */
    public function __construct(string $projectId, string $boardId, \Voidhash\Generated\Core\Model\CreateBoardTaskBodyJsonEncoding $requestBody, array $headerParameters = [])
    {
        $this->projectId = $projectId;
        $this->boardId = $boardId;
        $this->body = $requestBody;
        $this->headerParameters = $headerParameters;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{boardId}'], [$this->projectId, $this->boardId], '/api/v1/projects/{projectId}/boards/{boardId}/tasks');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\CreateBoardTaskBodyJsonEncoding) {
            return [['Content-Type' => ['application/json']], $serializer->serialize($this->body, 'json')];
        }
        return [[], null];
    }
    public function getExtraHeaders(): array
    {
        return ['Accept' => ['application/json']];
    }
    protected function getHeadersOptionsResolver(): \Symfony\Component\OptionsResolver\OptionsResolver
    {
        $optionsResolver = parent::getHeadersOptionsResolver();
        $optionsResolver->setDefined(['idempotency-key']);
        $optionsResolver->setRequired([]);
        $optionsResolver->setDefaults([]);
        $optionsResolver->addAllowedTypes('idempotency-key', ['string']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateTaskBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateTaskUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateTaskForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateTaskNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateTaskConflictException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateTaskInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\BoardsCreateTaskServiceUnavailableException
     *
     * @return null|\Voidhash\Generated\Core\Model\BoardTaskJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (201 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\BoardTaskJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\BoardsCreateTaskBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\BoardsCreateTaskUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\BoardsCreateTaskForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\BoardsCreateTaskNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\BoardsCreateTaskConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\BoardsCreateTaskInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (503 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\BoardsCreateTaskServiceUnavailableException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnavailableErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}