<?php

namespace Voidhash\Generated\Core\Endpoint;

class BoardsDeleteColumn extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $boardId;
    protected $columnId;
    /**
     * Deletes a column, moving its tasks to the column `moveTasksTo`. A board's last column can't be deleted, since there would be nowhere to move them.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $boardId
     * @param string $columnId
     * @param array{
     *    "moveTasksTo": string,
     * } $queryParameters
     */
    public function __construct(string $projectId, string $boardId, string $columnId, array $queryParameters = [])
    {
        $this->projectId = $projectId;
        $this->boardId = $boardId;
        $this->columnId = $columnId;
        $this->queryParameters = $queryParameters;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'DELETE';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{boardId}', '{columnId}'], [$this->projectId, $this->boardId, $this->columnId], '/api/v1/projects/{projectId}/boards/{boardId}/columns/{columnId}');
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
        $optionsResolver->setDefined(['moveTasksTo']);
        $optionsResolver->setRequired(['moveTasksTo']);
        $optionsResolver->setDefaults([]);
        $optionsResolver->addAllowedTypes('moveTasksTo', ['string']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\BoardsDeleteColumnBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\BoardsDeleteColumnUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\BoardsDeleteColumnForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\BoardsDeleteColumnNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\BoardsDeleteColumnConflictException
     * @throws \Voidhash\Generated\Core\Exception\BoardsDeleteColumnInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\BoardsDeleteColumnServiceUnavailableException
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
            throw new \Voidhash\Generated\Core\Exception\BoardsDeleteColumnBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\BoardsDeleteColumnUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\BoardsDeleteColumnForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\BoardsDeleteColumnNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\BoardsDeleteColumnConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\BoardsDeleteColumnInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (503 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\BoardsDeleteColumnServiceUnavailableException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnavailableErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}