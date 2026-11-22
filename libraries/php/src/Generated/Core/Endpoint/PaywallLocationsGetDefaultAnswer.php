<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaywallLocationsGetDefaultAnswer extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $paywallLocationId;
    /**
     * Reads what the location answers a new anonymous person in production, in the shape the SDK's `resolvePaywall` returns, for an app at `interfaceRevision`: what it shows everyone, never a pin or rule, and the control arm of an A/B test there, running or paused. It is what an app ships to show when it cannot reach Voidhash. It names the build the location shows, or the earlier build resolve serves instead to an app at an older revision, or while the build shown is withdrawn (`withdrawnBuild` names it then). The build is chosen for an SDK that shows every build; `requirements` says what an app's SDK needs to show it. A test key gets the same answer as a production key: production's. Fails with `conflict` (`paywall_location_archived`) for an archived location, `conflict` (`paywall_location_shows_nothing`) when the location shows nothing, `conflict` (`paywall_release_withdrawn`) when its build is withdrawn and no earlier build can be served instead, and `conflict` (`paywall_interface_revision_unsupported`) when no build of it can be shown by an app at that revision.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallLocationId The location's id, `pw_loc_...`.
     * @param array{
     *    "interfaceRevision"?: int, //The revision of the location's interface the app presents it at, as its SDK reports it: the one in `flowRevisions` or the generated types. Defaults to 0, an app that names none.
     * } $queryParameters
     */
    public function __construct(string $projectId, string $paywallLocationId, array $queryParameters = [])
    {
        $this->projectId = $projectId;
        $this->paywallLocationId = $paywallLocationId;
        $this->queryParameters = $queryParameters;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{paywallLocationId}'], [$this->projectId, $this->paywallLocationId], '/api/v1/projects/{projectId}/paywall-locations/{paywallLocationId}/default-answer');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        return [[], null];
    }
    public function getExtraHeaders(): array
    {
        return ['Accept' => ['application/json']];
    }
    protected function getQueryOptionsResolver(): \Symfony\Component\OptionsResolver\OptionsResolver
    {
        $optionsResolver = parent::getQueryOptionsResolver();
        $optionsResolver->setDefined(['interfaceRevision']);
        $optionsResolver->setRequired([]);
        $optionsResolver->setDefaults([]);
        $optionsResolver->addAllowedTypes('interfaceRevision', ['int']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsGetDefaultAnswerBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsGetDefaultAnswerUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsGetDefaultAnswerForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsGetDefaultAnswerNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsGetDefaultAnswerConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsGetDefaultAnswerInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaywallLocationDefaultAnswerJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaywallLocationDefaultAnswerJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsGetDefaultAnswerBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsGetDefaultAnswerUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsGetDefaultAnswerForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsGetDefaultAnswerNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsGetDefaultAnswerConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsGetDefaultAnswerInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}