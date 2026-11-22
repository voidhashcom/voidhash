<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaywallsSetEnvironment extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $paywallId;
    protected $environment;
    /**
     * Deploys a ready build to one environment: every location showing the paywall shows it there from now on, and the other environment keeps its build. Setting `test` lets a build be tried with a test key before end users get it; setting `production` with the build `test` has promotes it, and test follows production again. Test follows production until a build is set for test alone, and again once it is given production's build; while it has a build of its own, setting `production` leaves it in place. Setting an older build rolls that environment back to it. Setting the build the environment has already changes nothing, so repeating the request is safe. Answers the deployed build, and takes permission to publish paywalls in either environment. Fails with `not_found` (`paywall_not_found`) when the project has no such paywall, `not_found` (`paywall_build_not_found`) when the paywall has no such build, `conflict` (`paywall_build_not_ready`) while the build is `building` or after it `failed`, `conflict` (`paywall_build_withdrawn`) while it is withdrawn, and `conflict` (`paywall_build_components_unavailable`) when a component it embeds was yanked, deprecated, deleted or uninstalled since it was built, or it does not fit a location it would be shown at in that environment.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallId The paywall's id, `pw_...`.
     * @param string $environment The environment to deploy to: `production`, which apps using a production key are shown, or `test`, which only apps using a test key are shown.
     * @param \Voidhash\Generated\Core\Model\SetPaywallEnvironmentBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, string $paywallId, string $environment, \Voidhash\Generated\Core\Model\SetPaywallEnvironmentBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->paywallId = $paywallId;
        $this->environment = $environment;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PUT';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{paywallId}', '{environment}'], [$this->projectId, $this->paywallId, $this->environment], '/api/v1/projects/{projectId}/paywalls/{paywallId}/environments/{environment}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\SetPaywallEnvironmentBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\PaywallsSetEnvironmentBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsSetEnvironmentUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsSetEnvironmentForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsSetEnvironmentNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsSetEnvironmentConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsSetEnvironmentInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaywallBuildJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaywallBuildJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsSetEnvironmentBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsSetEnvironmentUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsSetEnvironmentForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsSetEnvironmentNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsSetEnvironmentConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsSetEnvironmentInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}