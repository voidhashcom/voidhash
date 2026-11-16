<?php

namespace Voidhash\Generated\Core\Endpoint;

class AdsGetCreativePreview extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $creativeId;
    /**
     * Shows one image of a synced creative, by the platform's id, as a model can look at it: an image, a video's poster frame, or the platform's small thumbnail when nothing larger was synced, upright, at most 1568 pixels on its longest side, as base64 JPEG. `media` picks which of its images and videos, from 0. It is fetched from the platform's CDN at the link the last sync stored. Fails with `not_found` (`creative_not_found`), `not_found` (`creative_image_not_found`) when no link to the image was synced or it is hosted outside the platform, `invalid_request` (`media_out_of_range` or `image_unreadable`), `invalid_request` (`image_too_large`) for an image over 30 MB, `unavailable` (`creative_image_expired`) when the platform no longer serves the link, which a later sync renews, and `unavailable` (`creative_image_unavailable`). Needs `project:ads:read`.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $creativeId The platform's id of the creative.
     * @param array{
     *    "media"?: int, //Which of the creative's images and videos, counted from 0 in the order the creatives report lists its `media`. Defaults to 0.
     * } $queryParameters
     */
    public function __construct(string $projectId, string $creativeId, array $queryParameters = [])
    {
        $this->projectId = $projectId;
        $this->creativeId = $creativeId;
        $this->queryParameters = $queryParameters;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{creativeId}'], [$this->projectId, $this->creativeId], '/api/v1/projects/{projectId}/ads/creatives/{creativeId}/preview');
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
        $optionsResolver->setDefined(['media']);
        $optionsResolver->setRequired([]);
        $optionsResolver->setDefaults([]);
        $optionsResolver->addAllowedTypes('media', ['int']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\AdsGetCreativePreviewBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetCreativePreviewUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetCreativePreviewForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetCreativePreviewNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetCreativePreviewInternalServerErrorException
     * @throws \Voidhash\Generated\Core\Exception\AdsGetCreativePreviewServiceUnavailableException
     *
     * @return null|\Voidhash\Generated\Core\Model\AdCreativePreviewJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\AdCreativePreviewJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AdsGetCreativePreviewBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AdsGetCreativePreviewUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AdsGetCreativePreviewForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AdsGetCreativePreviewNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AdsGetCreativePreviewInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (503 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AdsGetCreativePreviewServiceUnavailableException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnavailableErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}