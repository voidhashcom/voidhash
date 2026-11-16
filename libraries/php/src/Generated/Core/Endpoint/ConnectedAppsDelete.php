<?php

namespace Voidhash\Generated\Core\Endpoint;

class ConnectedAppsDelete extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $connectedAppId;
    /**
     * Disconnects an app: a CLI's key is deleted, and an MCP client must sign in again. Only the person signed in to the dashboard can. Fails with `permission_denied` (`dashboard_session_required`) for any other credential. Fails with `not_found` (`connected_app_not_found`) when the app is no longer connected.
     * @param string $connectedAppId The connected app's id, a UUID, as `GET /me/connected-apps` lists it.
     */
    public function __construct(string $connectedAppId)
    {
        $this->connectedAppId = $connectedAppId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'DELETE';
    }
    public function getUri(): string
    {
        return str_replace(['{connectedAppId}'], [$this->connectedAppId], '/api/v1/me/connected-apps/{connectedAppId}');
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
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsDeleteBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsDeleteUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsDeleteForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsDeleteNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ConnectedAppsDeleteInternalServerErrorException
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
            throw new \Voidhash\Generated\Core\Exception\ConnectedAppsDeleteBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ConnectedAppsDeleteUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ConnectedAppsDeleteForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ConnectedAppsDeleteNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ConnectedAppsDeleteInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}