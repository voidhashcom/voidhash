<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaywallsCreateBuild extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $paywallId;
    /**
     * Starts building the paywall's current design in the background and answers 202 with the build `building`; read it with `getBuild` until it is `ready` or `failed`, then deploy it. The build compiles what the paywall may exchange with apps as its locations give it now, and is `failed` at once, with what to change, while two of its locations conflict. Fails with `conflict` (`paywall_document_changed`) when the design has changed since the `documentVersion` given; nothing is built then. A person or a project secret key with permission to edit paywalls can start a build; the build records which. Deploying it takes permission to publish paywalls. A project may start 120 builds an hour, and all projects of an organization 600 together. Fails with `rate_limited` (`paywall_build_rate_limited`) past that, with a `Retry-After` header in seconds, and with `conflict` (`flow_build_limit_reached`) once the paywall was built 10,000 times; a duplicate of it can be built.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallId The paywall's id, `pw_...`.
     * @param \Voidhash\Generated\Core\Model\CreatePaywallBuildBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, string $paywallId, \Voidhash\Generated\Core\Model\CreatePaywallBuildBodyJsonEncoding $requestBody)
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
        return str_replace(['{projectId}', '{paywallId}'], [$this->projectId, $this->paywallId], '/api/v1/projects/{projectId}/paywalls/{paywallId}/builds');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\CreatePaywallBuildBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreateBuildBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreateBuildUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreateBuildForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreateBuildNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreateBuildConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreateBuildTooManyRequestsException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreateBuildInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaywallBuildJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (202 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaywallBuildJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsCreateBuildBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsCreateBuildUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsCreateBuildForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsCreateBuildNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsCreateBuildConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (429 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsCreateBuildTooManyRequestsException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\RateLimitedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsCreateBuildInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}