<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaywallsGetBuildWithdrawal extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $paywallId;
    protected $buildId;
    /**
     * Says what withdrawing a ready build changes, before `withdrawBuild`, or for a withdrawn build what it changed: each location whose showing, rules or pins serve it to production or test keys while it is deployed there, and each arm of a running or paused A/B test that keeps it, with the build each serves apps instead (`servedBuildNumber`), or null when they are shown no paywall there. Arms are left out when the credential cannot read experiments. A build `building` or `failed` was never served, so it lists no place. Fails with `not_found` (`paywall_build_not_found`) when the paywall has no such build.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallId The paywall's id, `pw_...`.
     * @param string $buildId The build's id, `pw_build_...`.
     */
    public function __construct(string $projectId, string $paywallId, string $buildId)
    {
        $this->projectId = $projectId;
        $this->paywallId = $paywallId;
        $this->buildId = $buildId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{paywallId}', '{buildId}'], [$this->projectId, $this->paywallId, $this->buildId], '/api/v1/projects/{projectId}/paywalls/{paywallId}/builds/{buildId}/withdrawal');
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
     * @throws \Voidhash\Generated\Core\Exception\PaywallsGetBuildWithdrawalBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsGetBuildWithdrawalUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsGetBuildWithdrawalForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsGetBuildWithdrawalNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsGetBuildWithdrawalInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaywallBuildWithdrawalJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaywallBuildWithdrawalJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsGetBuildWithdrawalBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsGetBuildWithdrawalUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsGetBuildWithdrawalForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsGetBuildWithdrawalNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsGetBuildWithdrawalInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}