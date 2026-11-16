<?php

namespace Voidhash\Generated\Core\Endpoint;

class ComponentRegistryDeleteInstall extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $installId;
    /**
     * Uninstalls a registry component from the project. Published paywalls keep working; paywalls that still place it cannot be published again until it is installed again. Fails with `not_found` (`component_install_not_found`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $installId The install's id, `cmp_inst_...`.
     */
    public function __construct(string $projectId, string $installId)
    {
        $this->projectId = $projectId;
        $this->installId = $installId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'DELETE';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{installId}'], [$this->projectId, $this->installId], '/api/v1/projects/{projectId}/component-installs/{installId}');
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
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryDeleteInstallBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryDeleteInstallUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryDeleteInstallForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryDeleteInstallNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentRegistryDeleteInstallInternalServerErrorException
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
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryDeleteInstallBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryDeleteInstallUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryDeleteInstallForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryDeleteInstallNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentRegistryDeleteInstallInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}