<?php

namespace Voidhash\Generated\Core\Endpoint;

class DevelopmentApplyDevelopmentLifecycleAction extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    /**
     * @param \Voidhash\Generated\Core\Model\DevelopmentLifecycleActionBody $requestBody
     */
    public function __construct(\Voidhash\Generated\Core\Model\DevelopmentLifecycleActionBody $requestBody)
    {
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return '/api/v1/development/lifecycle-actions';
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\DevelopmentLifecycleActionBody) {
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
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentApplyDevelopmentLifecycleActionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentApplyDevelopmentLifecycleActionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentApplyDevelopmentLifecycleActionConflictException
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentApplyDevelopmentLifecycleActionInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\ApiV1DevelopmentLifecycleActionsPostResponse202
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (202 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiV1DevelopmentLifecycleActionsPostResponse202', 'json');
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\DevelopmentApplyDevelopmentLifecycleActionUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\DevelopmentApplyDevelopmentLifecycleActionForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\DevelopmentApplyDevelopmentLifecycleActionConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiDevelopmentEnvironmentRequiredErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\DevelopmentApplyDevelopmentLifecycleActionInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}