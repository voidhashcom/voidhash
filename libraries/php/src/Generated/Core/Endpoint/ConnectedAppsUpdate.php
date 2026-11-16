<?php

namespace Voidhash\Generated\Core\Endpoint;

class ConnectedAppsUpdate extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $connectedAppId;
    /**
     * Limits a connected app to reading, or lifts the limit. Only the person signed in to the dashboard can. Fails with `permission_denied` (`dashboard_session_required`) for any other credential. Fails with `not_found` (`connected_app_not_found`) when the app is no longer connected.
     * @param string $connectedAppId The connected app's id, a UUID, as `GET /me/connected-apps` lists it.
     * @param \Voidhash\Generated\Core\Model\UpdateConnectedAppBodyJsonEncoding $requestBody
     */
    public function __construct(string $connectedAppId, \Voidhash\Generated\Core\Model\UpdateConnectedAppBodyJsonEncoding $requestBody)
    {
        $this->connectedAppId = $connectedAppId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PATCH';
    }
    public function getUri(): string
    {
        return str_replace(['{connectedAppId}'], [$this->connectedAppId], '/api/v1/me/connected-apps/{connectedAppId}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpdateConnectedAppBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsUpdateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsUpdateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsUpdateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsUpdateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsUpdateInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\ConnectedAppJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConnectedAppJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ConnectedAppsUpdateBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ConnectedAppsUpdateUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ConnectedAppsUpdateForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ConnectedAppsUpdateNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ConnectedAppsUpdateInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}