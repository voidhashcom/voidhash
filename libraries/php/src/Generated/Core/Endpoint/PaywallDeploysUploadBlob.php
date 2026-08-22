<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaywallDeploysUploadBlob extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $deployId;
    protected $sha256;
    /**
     * @param string $deployId
     * @param string $sha256
     * @param string|resource|\Psr\Http\Message\StreamInterface $requestBody
     */
    public function __construct(string $deployId, string $sha256, $requestBody)
    {
        $this->deployId = $deployId;
        $this->sha256 = $sha256;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PUT';
    }
    public function getUri(): string
    {
        return str_replace(['{deployId}', '{sha256}'], [$this->deployId, $this->sha256], '/api/v1/paywall-deploys/{deployId}/blobs/{sha256}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if (is_string($this->body) or is_resource($this->body) or $this->body instanceof \Psr\Http\Message\StreamInterface) {
            return [['Content-Type' => ['application/octet-stream']], $this->body];
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
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysUploadBlobUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysUploadBlobForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysUploadBlobNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysUploadBlobConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysUploadBlobUnprocessableEntityException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysUploadBlobInternalServerErrorException
     *
     * @return null
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return json_decode($body);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallDeploysUploadBlobUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiNotAuthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallDeploysUploadBlobForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallDeploysUploadBlobNotFoundException($response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallDeploysUploadBlobConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaywallDeployNotPendingErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (422 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallDeploysUploadBlobUnprocessableEntityException($response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallDeploysUploadBlobInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}