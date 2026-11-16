<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaywallLocationsListRules extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $paywallLocationId;
    /**
     * Lists the location's rules in the order they are read: each shows the end users all its conditions hold for another paywall than the location shows everyone else. Both environments unless `environment` names one.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $paywallLocationId The location's id, `pw_loc_...`.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "environment"?: string, //Only the rules of one environment: `production` or `test`. Omitted, both are listed, production's first.
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
        return str_replace(['{projectId}', '{paywallLocationId}'], [$this->projectId, $this->paywallLocationId], '/api/v1/projects/{projectId}/paywall-locations/{paywallLocationId}/rules');
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
        $optionsResolver->setDefined(['cursor', 'limit', 'environment']);
        $optionsResolver->setRequired([]);
        $optionsResolver->setDefaults([]);
        $optionsResolver->addAllowedTypes('cursor', ['string']);
        $optionsResolver->addAllowedTypes('limit', ['int']);
        $optionsResolver->addAllowedTypes('environment', ['string']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListRulesBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListRulesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListRulesForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListRulesNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListRulesInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallLocationsPaywallLocationIdRulesGetResponse200
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdPaywallLocationsPaywallLocationIdRulesGetResponse200', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsListRulesBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsListRulesUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsListRulesForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsListRulesNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallLocationsListRulesInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}