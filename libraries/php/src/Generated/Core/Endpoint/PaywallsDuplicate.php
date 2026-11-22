<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaywallsDuplicate extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $paywallId;
    /**
     * Creates a paywall in the same project whose design is a copy of this paywall's current one: every screen, layer, component, variable, logic, translation and setting. The copy is made for the same locations and uses the same images, fonts, components and products, which belong to the project. It has no builds, and no location shows it, so nobody sees it until a build of it is deployed and shown. Named after the paywall with "copy" and a free slug unless `name` and `slug` are given. Archived paywalls can be duplicated too; the copy is not archived. Fails with `conflict` (`paywall_slug_taken`) when the `slug` given is in use.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallId The paywall's id, `pw_...`.
     * @param \Voidhash\Generated\Core\Model\DuplicatePaywallBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, string $paywallId, \Voidhash\Generated\Core\Model\DuplicatePaywallBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->paywallId = $paywallId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{paywallId}'], [$this->projectId, $this->paywallId], '/api/v1/projects/{projectId}/paywalls/{paywallId}/duplicate');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\DuplicatePaywallBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDuplicateBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDuplicateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDuplicateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDuplicateNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDuplicateConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsDuplicateInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaywallJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (201 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaywallJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsDuplicateBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsDuplicateUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsDuplicateForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsDuplicateNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsDuplicateConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsDuplicateInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}