<?php

namespace Voidhash\Generated\Core\Endpoint;

class PerksGetPerk extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $perkId;
    /**
     * @param string $perkId
     */
    public function __construct(string $perkId)
    {
        $this->perkId = $perkId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{perkId}'], [$this->perkId], '/api/v1/perks/{perkId}');
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
     * @throws \Voidhash\Generated\Core\Exception\PerksGetPerkUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PerksGetPerkForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PerksGetPerkNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PerksGetPerkInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PerkJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PerkJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PerksGetPerkUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PerksGetPerkForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PerksGetPerkNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPerkNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PerksGetPerkInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}