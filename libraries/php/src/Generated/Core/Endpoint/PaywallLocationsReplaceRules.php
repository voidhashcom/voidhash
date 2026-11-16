<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaywallLocationsReplaceRules extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $paywallLocationId;
    /**
     * Replaces the rules of the location in one `environment`, in the order given; an empty list removes them. The first rule whose conditions all hold for an end user and their app shows them its paywall's deployed build, in place of what the location shows everyone else, and keeps them out of an A/B test running there. Conditions are those of a feature flag's rule. Pins are read before rules. A `production` rule answers every app; a `test` rule answers apps using a test key only and is read first there. A rule shows only where the location shows something in that environment. Fails with `invalid_request` (`invalid_rules`) for a rule without conditions or with one that can't be read, `not_found` (`paywall_not_found`) when the project has no such paywall, and `conflict` (`paywall_not_deployed`) when a paywall has no deployed build or `conflict` (`paywall_location_archived`) when the location is archived.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallLocationId The location's id, `pw_loc_...`.
     * @param \Voidhash\Generated\Core\Model\ReplacePaywallLocationRulesBodyJsonEncoding $requestBody
     * @param array{
     *    "environment"?: string, //The environment whose rules are replaced: `production`, the default, whose rules answer every app, or `test`, whose rules answer apps using a test key only and are read first there.
     * } $queryParameters
     */
    public function __construct(string $projectId, string $paywallLocationId, \Voidhash\Generated\Core\Model\ReplacePaywallLocationRulesBodyJsonEncoding $requestBody, array $queryParameters = [])
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
        return str_replace(['{projectId}', '{paywallLocationId}'], [$this->projectId, $this->paywallLocationId], '/api/v1/projects/{projectId}/paywall-locations/{paywallLocationId}/rules');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\ReplacePaywallLocationRulesBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsReplaceRulesBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsReplaceRulesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsReplaceRulesForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsReplaceRulesNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsReplaceRulesConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsReplaceRulesInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PaywallLocationRulesJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PaywallLocationRulesJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsReplaceRulesBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsReplaceRulesUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsReplaceRulesForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsReplaceRulesNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsReplaceRulesConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsReplaceRulesInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}