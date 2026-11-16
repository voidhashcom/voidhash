<?php

namespace Voidhash\Generated\Core\Endpoint;

class AdsListCampaigns extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    /**
     * Lists the campaigns synced from the project's ad accounts, ordered by name. Filter by `adAccountId`, `status`, `deliveryStatus`, `destination`, or `search` (the name, ignoring case, or the exact id). Fails with `invalid_request` (`ad_account_not_connected`) for a filter naming an account the project has not connected. Needs `project:ads:read`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param array{
     *    "cursor"?: string, //Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *    "limit"?: int, //How many items to return, from 1 to 100. Defaults to 50.
     *    "adAccountId"?: string, //Only objects of this connected account, `ad_acct_...`; an account the project has not connected fails with `ad_account_not_connected`.
     *    "status"?: string, //Only objects with this status set on the platform: `on`, `paused` or `removed`.
     *    "deliveryStatus"?: string, //Only objects with this delivery status, such as `delivering` or `rejected`.
     *    "destination"?: string, //Only objects whose ads send people here: `website`, `app_store`, `web_to_app` or `mixed`.
     *    "search"?: string, //Only objects whose name contains this text, ignoring case, or whose id is exactly it. At most 200 characters.
     * } $queryParameters
     */
    public function __construct(string $projectId, array $queryParameters = [])
    {
        $this->projectId = $projectId;
        $this->queryParameters = $queryParameters;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}'], [$this->projectId], '/api/v1/projects/{projectId}/ads/campaigns');
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
        $optionsResolver->setDefined(['cursor', 'limit', 'adAccountId', 'status', 'deliveryStatus', 'destination', 'search']);
        $optionsResolver->setRequired([]);
        $optionsResolver->setDefaults([]);
        $optionsResolver->addAllowedTypes('cursor', ['string']);
        $optionsResolver->addAllowedTypes('limit', ['int']);
        $optionsResolver->addAllowedTypes('adAccountId', ['string']);
        $optionsResolver->addAllowedTypes('status', ['string']);
        $optionsResolver->addAllowedTypes('deliveryStatus', ['string']);
        $optionsResolver->addAllowedTypes('destination', ['string']);
        $optionsResolver->addAllowedTypes('search', ['string']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\AdsListCampaignsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AdsListCampaignsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AdsListCampaignsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AdsListCampaignsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AdsListCampaignsInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAdsCampaignsGetResponse200
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdAdsCampaignsGetResponse200', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AdsListCampaignsBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AdsListCampaignsUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AdsListCampaignsForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AdsListCampaignsNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AdsListCampaignsInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}