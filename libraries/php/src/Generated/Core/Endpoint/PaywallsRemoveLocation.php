<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaywallsRemoveLocation extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $paywallId;
    protected $paywallLocationId;
    /**
     * Stops making the paywall for a location; removing one it is not made for changes nothing. Fails with `conflict` (`paywall_location_in_use`) while the paywall is shown, placed by an A/B test, pinned or matched by a rule there, and `conflict` (`paywall_location_required`) while the paywall's design uses something only that location provides: an input it reads or an output it writes that no other of its locations declares, or, for its last location, an app action it calls or an outcome it ends with; the message says what to change. A paywall made for no location exchanges nothing with apps.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallId The paywall's id, `pw_...`.
     * @param string $paywallLocationId The location's id, `pw_loc_...`.
     */
    public function __construct(string $projectId, string $paywallId, string $paywallLocationId)
    {
        $this->projectId = $projectId;
        $this->paywallId = $paywallId;
        $this->paywallLocationId = $paywallLocationId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'DELETE';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{paywallId}', '{paywallLocationId}'], [$this->projectId, $this->paywallId, $this->paywallLocationId], '/api/v1/projects/{projectId}/paywalls/{paywallId}/locations/{paywallLocationId}');
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
     * @throws \Voidhash\Generated\Core\Exception\PaywallsRemoveLocationBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsRemoveLocationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsRemoveLocationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsRemoveLocationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsRemoveLocationConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsRemoveLocationInternalServerErrorException
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
            throw new \Voidhash\Generated\Core\Exception\PaywallsRemoveLocationBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsRemoveLocationUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsRemoveLocationForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsRemoveLocationNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsRemoveLocationConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallsRemoveLocationInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}