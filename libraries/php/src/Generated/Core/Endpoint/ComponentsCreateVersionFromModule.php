<?php

namespace Voidhash\Generated\Core\Endpoint;

class ComponentsCreateVersionFromModule extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    /**
     * Uploads a prebuilt module as a new `ready` version of the component its `slug` names, creating the component on its first upload. The module must be a WebAssembly binary of at most 2 MiB carrying a valid `vh.manifest` section (a guest ABI 1 manifest or an ABI 2 component definition); a definition that declares an editor panel needs its panel module in `panelBase64`. Without a `slug` the manifest's name is used. A version that fails the conformance checks is kept so its findings can be read, but cannot be placed. Fails with `invalid_request` (`invalid_slug`, `invalid_module`, `invalid_panel_module`) naming every problem, and `unavailable` (`component_checks_unavailable`) when the conformance checks could not run; nothing is stored then, so try again.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\CreatePaywallComponentModuleVersionBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, \Voidhash\Generated\Core\Model\CreatePaywallComponentModuleVersionBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}'], [$this->projectId], '/api/v1/projects/{projectId}/components/modules');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\CreatePaywallComponentModuleVersionBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromModuleBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromModuleUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromModuleForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromModuleNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromModuleInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromModuleServiceUnavailableException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaywallComponentVersionJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (201 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaywallComponentVersionJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromModuleBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromModuleUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromModuleForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromModuleNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromModuleInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (503 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ComponentsCreateVersionFromModuleServiceUnavailableException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnavailableErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}