<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaywallLocationsSetShowing extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $paywallLocationId;
    /**
     * Places a paywall at the location: from now on, end users see its deployed build there. This ends the location's previous placement, a paused experiment's included. With `environment=test` only apps using a test key see it, and production keeps what it shows; until a location has a test showing, test keys get production's. Placing the paywall the environment already shows changes nothing. Fails with `not_found` (`paywall_not_found`) when the project has no such paywall, and with `conflict` (`paywall_not_deployed`) when the paywall has no deployed build, `conflict` (`paywall_interface_mismatch`) when its deployed flow asks more of the app than the location's interface offers, `conflict` (`paywall_location_archived`) when the location is archived, or `conflict` (`paywall_location_test_running`) while an experiment runs there: pause it first.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallLocationId The location's id, `pw_loc_...`.
     * @param \Voidhash\Generated\Core\Model\SetPaywallLocationShowingBodyJsonEncoding $requestBody
     * @param array{
     *    "environment"?: string, //The environment whose showing is meant: `production`, the default, or `test`, which only apps using a test key see. Test follows production until it is given a showing of its own, and clearing test's goes back to following production.
     * } $queryParameters
     */
    public function __construct(string $projectId, string $paywallLocationId, \Voidhash\Generated\Core\Model\SetPaywallLocationShowingBodyJsonEncoding $requestBody, array $queryParameters = [])
    {
        $this->projectId = $projectId;
        $this->paywallLocationId = $paywallLocationId;
        $this->body = $requestBody;
        $this->queryParameters = $queryParameters;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PUT';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{paywallLocationId}'], [$this->projectId, $this->paywallLocationId], '/api/v1/projects/{projectId}/paywall-locations/{paywallLocationId}/showing');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\SetPaywallLocationShowingBodyJsonEncoding) {
            return [['Content-Type' => ['application/json']], $serializer->serialize($this->body, 'json')];
        }
        return [[], null];
    }
    public function getExtraHeaders(): array
    {
        return ['Accept' => ['application/json']];
    }
    protected function getQueryOptionsResolver(): \Symfony\Component\OptionsResolver\OptionsResolver
    {
        $optionsResolver = parent::getQueryOptionsResolver();
        $optionsResolver->setDefined(['environment']);
        $optionsResolver->setRequired([]);
        $optionsResolver->setDefaults([]);
        $optionsResolver->addAllowedTypes('environment', ['string']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetShowingBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetShowingUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetShowingForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetShowingNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetShowingConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetShowingInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaywallLocationShowingJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaywallLocationShowingJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsSetShowingBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsSetShowingUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsSetShowingForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsSetShowingNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsSetShowingConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsSetShowingInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}