<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaywallLocationsUpsertPin extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $paywallLocationId;
    protected $identity;
    /**
     * Pins one end user, `{identityType}:{identityValue}` in the path, to a paywall at the location: they see its deployed build there whatever the location shows everyone else, and are outside an A/B test running there. Replaces the end user's pin in that `environment`, answering 201 when there was none. A `production` pin answers every app; a `test` pin answers apps using a test key only and wins there. A pin shows only where the location shows something in that environment. Fails with `invalid_request` (`invalid_identity`) for an identity that is blank or longer than 255 characters, `not_found` (`paywall_not_found`) when the project has no such paywall, and `conflict` (`paywall_not_deployed`) when the paywall has no deployed build, `conflict` (`paywall_interface_mismatch`) when its deployed flow asks more of the app than the location's interface offers, `conflict` (`paywall_location_archived`) when the location is archived, or `conflict` (`paywall_location_pin_limit`) when the location already holds 200 pins.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallLocationId The location's id, `pw_loc_...`.
     * @param string $identity The end user, as `{identityType}:{identityValue}` with the value percent-encoded, such as `email:alice@example.com`. The type is `person_id`, `distinct_id` or `email`.
     * @param \Voidhash\Generated\Core\Model\PutPaywallLocationPinBodyJsonEncoding $requestBody
     * @param array{
     *    "environment"?: string, //The environment the pin is for: `production`, the default, which answers every app, or `test`, which answers apps using a test key only and wins there.
     * } $queryParameters
     */
    public function __construct(string $projectId, string $paywallLocationId, string $identity, \Voidhash\Generated\Core\Model\PutPaywallLocationPinBodyJsonEncoding $requestBody, array $queryParameters = [])
    {
        $this->projectId = $projectId;
        $this->paywallLocationId = $paywallLocationId;
        $this->identity = $identity;
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
        return str_replace(['{projectId}', '{paywallLocationId}', '{identity}'], [$this->projectId, $this->paywallLocationId, $this->identity], '/api/v1/projects/{projectId}/paywall-locations/{paywallLocationId}/pins/{identity}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\PutPaywallLocationPinBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpsertPinBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpsertPinUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpsertPinForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpsertPinNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpsertPinConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpsertPinInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaywallLocationPinJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaywallLocationPinJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (201 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaywallLocationPinJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsUpsertPinBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsUpsertPinUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsUpsertPinForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsUpsertPinNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsUpsertPinConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsUpsertPinInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}