<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaywallsDelete extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $paywallId;
    /**
     * Deletes a paywall for good, archived or not. This cannot be undone, and a location showing the paywall shows nothing afterwards; archive it to keep it instead.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallId The paywall's id, `pw_...`.
     */
    public function __construct(string $projectId, string $paywallId)
    {
        $this->projectId = $projectId;
        $this->paywallId = $paywallId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'DELETE';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{paywallId}'], [$this->projectId, $this->paywallId], '/api/v1/projects/{projectId}/paywalls/{paywallId}');
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
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDeleteInternalServerErrorException
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
            throw new \Voidhash\Generated\Core\Exception\PaywallsDeleteBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsDeleteUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsDeleteForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsDeleteNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsDeleteInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}