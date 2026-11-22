<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaywallsWithdrawBuild extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $paywallId;
    protected $buildId;
    /**
     * Withdraws a ready build as bad, in production and test at once: from now on no app is served it, whether through a location's showing, rules or pins or an A/B test arm, nor as the earlier build apps that cannot show a newer one fall back to. Wherever it is placed, apps are served the most recent earlier build deployed there that is not withdrawn and fits, an arm preferring the builds it kept before, or no paywall when there is none; `getBuildWithdrawal` lists each place and what it serves first. Nothing deployed or placed changes, and the build cannot be deployed, nor an arm moved to it, until `restoreBuild` restores it. Apps resolving the paywall are told its package hash, so one does not show the copy it holds instead. Withdrawing a withdrawn build changes nothing. Takes permission to publish paywalls and is recorded in the audit log. Fails with `conflict` (`paywall_build_not_ready`) while the build is `building` or after it `failed`, and `conflict` (`paywall_withdrawal_limit`) when the paywall has 100 builds withdrawn.
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
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{paywallId}', '{buildId}'], [$this->projectId, $this->paywallId, $this->buildId], '/api/v1/projects/{projectId}/paywalls/{paywallId}/builds/{buildId}/withdraw');
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
     * @throws \Voidhash\Generated\Core\Exception\PaywallsWithdrawBuildBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsWithdrawBuildUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsWithdrawBuildForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsWithdrawBuildNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsWithdrawBuildConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsWithdrawBuildInternalServerErrorException
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
            throw new \Voidhash\Generated\Core\Exception\PaywallsWithdrawBuildBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsWithdrawBuildUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsWithdrawBuildForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsWithdrawBuildNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsWithdrawBuildConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsWithdrawBuildInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}