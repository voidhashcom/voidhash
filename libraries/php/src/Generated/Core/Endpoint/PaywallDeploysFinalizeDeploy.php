<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaywallDeploysFinalizeDeploy extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $deployId;
    /**
     * @param string $deployId
     */
    public function __construct(string $deployId)
    {
        $this->deployId = $deployId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{deployId}'], [$this->deployId], '/api/v1/paywall-deploys/{deployId}/finalize');
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
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysFinalizeDeployUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysFinalizeDeployForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysFinalizeDeployNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysFinalizeDeployConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysFinalizeDeployUnprocessableEntityException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysFinalizeDeployInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\FinalizePaywallDeployResponseJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\FinalizePaywallDeployResponseJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallDeploysFinalizeDeployUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallDeploysFinalizeDeployForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallDeploysFinalizeDeployNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaywallDeployNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallDeploysFinalizeDeployConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiIncompleteDeployErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (422 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallDeploysFinalizeDeployUnprocessableEntityException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaywallDeployValidationErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallDeploysFinalizeDeployInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}