<?php

namespace Voidhash\Generated\Core\Endpoint;

class AssetsGetPreview extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $assetId;
    /**
     * Shows an image asset as a model can look at it: upright, at most 1568 pixels on its longest side, as base64 JPEG. Fails with `not_found` (`asset_not_found`), `invalid_request` (`image_unreadable`) for an asset that is not a JPEG, PNG, WebP or GIF image, and `invalid_request` (`image_too_large`) for one over 30 MB.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $assetId The asset's id, `asset_...` or `pw_asset_...`.
     */
    public function __construct(string $projectId, string $assetId)
    {
        $this->projectId = $projectId;
        $this->assetId = $assetId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{assetId}'], [$this->projectId, $this->assetId], '/api/v1/projects/{projectId}/assets/{assetId}/preview');
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
     * @throws \Voidhash\Generated\Core\Exception\AssetsGetPreviewBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AssetsGetPreviewUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AssetsGetPreviewForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AssetsGetPreviewNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AssetsGetPreviewInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\ImagePreviewJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ImagePreviewJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AssetsGetPreviewBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AssetsGetPreviewUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AssetsGetPreviewForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AssetsGetPreviewNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AssetsGetPreviewInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}