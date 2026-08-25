<?php

namespace Voidhash\Generated\Core\Endpoint;

class ExperimentsConcludeExperiment extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $experimentId;
    /**
     * @param string $experimentId
     * @param \Voidhash\Generated\Core\Model\ConcludeExperimentBodyJsonEncoding $requestBody
     */
    public function __construct(string $experimentId, \Voidhash\Generated\Core\Model\ConcludeExperimentBodyJsonEncoding $requestBody)
    {
        $this->experimentId = $experimentId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{experimentId}'], [$this->experimentId], '/api/v1/experiments/{experimentId}/conclude');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\ConcludeExperimentBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsConcludeExperimentUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsConcludeExperimentForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsConcludeExperimentNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsConcludeExperimentConflictException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsConcludeExperimentInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\ExperimentJsonEncoding1
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ExperimentJsonEncoding1', 'json');
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsConcludeExperimentUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsConcludeExperimentForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsConcludeExperimentNotFoundException($response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsConcludeExperimentConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiExperimentConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsConcludeExperimentInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}